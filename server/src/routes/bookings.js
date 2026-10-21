import express from "express";
import qrcode from "qrcode";
import { getDb, mutate } from "../store.js";
import { authRequired, requireRole } from "../auth.js";
import {
  nowIso,
  addMinutes,
  seatCategory,
  unitPrice,
  buildSeatIds,
  takenSeats,
  expireHolds,
  audit,
  bookingReference,
  reapHolds,
} from "../helpers.js";
import { enrichBooking } from "../view.js";
import { asyncHandler, bodyString } from "../validate.js";

const router = express.Router();

function ownBookingOrStaff(record, user) {
  if (user.role === "customer" && record.userId !== user.id) {
    throw new Error("Not your booking");
  }
}

router.post(
  "/api/bookings",
  authRequired,
  requireRole("customer", "staff", "admin"),
  async (req, res) => {
    const { showtimeId, seats, paymentMethod, customerEmail } = req.body || {};
    if (!showtimeId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ error: "Showtime and seats are required" });
    }
    try {
      const booking = await mutate((db) => {
        expireHolds(db);
        const settings = db.settings;
        if (seats.length > settings.maxTicketsPerBooking) {
          throw new Error(`Maximum ${settings.maxTicketsPerBooking} tickets per booking`);
        }
        const showtime = db.showtimes.find((s) => s.id === showtimeId);
        if (!showtime) throw new Error("Showtime not found");
        if (showtime.status === "cancelled") throw new Error("This showtime is cancelled");
        if (new Date(showtime.startAt) <= new Date()) {
          throw new Error("Booking is closed for this showtime");
        }
        const hall = db.halls.find((h) => h.id === showtime.hallId);
        if (!hall) throw new Error("Hall not found");
        const validSeats = new Set(buildSeatIds(hall));
        const taken = takenSeats(db, showtimeId);
        const requested = new Set();
        for (const item of seats) {
          const seatId = bodyString(item?.seatId).toUpperCase();
          const ticketType = bodyString(item?.ticketType);
          if (!seatId) throw new Error("Each seat must have a seatId");
          if (requested.has(seatId)) throw new Error(`Seat ${seatId} is selected twice`);
          requested.add(seatId);
          if (!validSeats.has(seatId)) throw new Error(`Invalid seat ${seatId}`);
          if (taken.has(seatId)) throw new Error(`Seat ${seatId} is not available`);
          if (!["adult", "child", "student"].includes(ticketType)) {
            throw new Error("Ticket type must be adult, child, or student");
          }
        }
        let userId = req.user.id;
        if (req.user.role !== "customer") {
          const wantedEmail = emailOf(customerEmail);
          if (!wantedEmail) throw new Error("Customer email is required for staff bookings");
          const customer = db.users.find(
            (u) => emailOf(u.email) === wantedEmail && u.role === "customer"
          );
          if (!customer) throw new Error("Customer account not found");
          userId = customer.id;
        }
        const method = paymentMethod === "pay_at_cinema" ? "pay_at_cinema" : "online";
        const bookingId = crypto.randomUUID();
        const tickets = seats.map((item) => {
          const seatId = bodyString(item?.seatId).toUpperCase();
          const ticketType = bodyString(item?.ticketType);
          const category = seatCategory(hall, seatId);
          const price = unitPrice(showtime, category, ticketType);
          return {
            id: crypto.randomUUID(),
            bookingId,
            seatId,
            seatCategory: category,
            ticketType,
            price,
            qrToken: crypto.randomUUID(),
            usedAt: null,
          };
        });
        const total = tickets.reduce((s, t) => s + t.price, 0);
        const record = {
          id: bookingId,
          userId,
          showtimeId,
          status: "held",
          paymentMethod: method,
          holdExpiresAt: addMinutes(nowIso(), settings.reservationHoldMinutes),
          total,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          createdBy: req.user.id,
        };
        db.bookings.push(record);
        db.tickets.push(...tickets);
        audit(db, req.user.id, "booking.create", `Held ${tickets.length} seats, total ${total} EGP`);
        return enrichBooking(db, record);
      });
      res.status(201).json(booking);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

function emailOf(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

router.post("/api/bookings/:id/pay-demo", authRequired, async (req, res) => {
  try {
    const booking = await mutate((db) => {
      expireHolds(db);
      const record = db.bookings.find((b) => b.id === req.params.id);
      if (!record) throw new Error("Booking not found");
      ownBookingOrStaff(record, req.user);
      if (record.status !== "held") throw new Error("Booking is not awaiting payment");
      const digits = String(req.body?.cardNumber || "").replace(/[\s-]/g, "");
      if (!/^\d{13,19}$/.test(digits)) throw new Error("Enter a valid demo card number");
      if (digits === "4000000000000002") {
        throw new Error("Demo payment declined. Please retry or choose pay at cinema.");
      }
      record.status = "confirmed";
      record.paymentMethod = "online";
      record.paidAt = nowIso();
      record.updatedAt = nowIso();
      audit(db, req.user.id, "payment.demo_success", `Booking ${bookingReference(record.id)} confirmed`);
      return enrichBooking(db, record);
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/bookings/:id/switch-pay-at-cinema", authRequired, async (req, res) => {
  try {
    const booking = await mutate((db) => {
      expireHolds(db);
      const record = db.bookings.find((b) => b.id === req.params.id);
      if (!record) throw new Error("Booking not found");
      ownBookingOrStaff(record, req.user);
      if (record.status !== "held") throw new Error("Booking cannot be changed");
      record.paymentMethod = "pay_at_cinema";
      record.updatedAt = nowIso();
      audit(db, req.user.id, "booking.switch_pay_at_cinema", bookingReference(record.id));
      return enrichBooking(db, record);
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get(
  "/api/bookings/mine",
  authRequired,
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    await reapHolds();
    const db = getDb();
    const q = (req.query.q || "").toString().toLowerCase();
    let list = db.bookings
      .filter((b) => b.userId === req.user.id)
      .map((b) => enrichBooking(db, b))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (q) {
      list = list.filter(
        (b) =>
          b.reference.toLowerCase().includes(q) ||
          b.showtime?.movie?.title.toLowerCase().includes(q) ||
          b.status.includes(q)
      );
    }
    res.json(list);
  })
);

router.get("/api/bookings/:id", authRequired, (req, res) => {
  const db = getDb();
  const record = db.bookings.find((b) => b.id === req.params.id);
  if (!record) return res.status(404).json({ error: "Booking not found" });
  if (req.user.role === "customer" && record.userId !== req.user.id) {
    return res.status(403).json({ error: "Not your booking" });
  }
  res.json(enrichBooking(db, record));
});

router.get(
  "/api/tickets/:id/qr",
  authRequired,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const booking = db.bookings.find((b) => b.id === ticket.bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (req.user.role === "customer" && booking.userId !== req.user.id) {
      return res.status(403).json({ error: "Not your ticket" });
    }
    if (booking.status !== "confirmed") {
      return res.status(400).json({ error: "Ticket is not confirmed" });
    }
    const token = `TICKET:${ticket.qrToken}`;
    const dataUrl = await qrcode.toDataURL(token);
    res.json({ dataUrl, token });
  })
);

export default router;
