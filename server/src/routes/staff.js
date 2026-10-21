import express from "express";
import { getDb, mutate } from "../store.js";
import { authRequired, requireRole } from "../auth.js";
import { nowIso, expireHolds, audit, bookingReference, reapHolds } from "../helpers.js";
import { enrichShowtime, enrichBooking, database } from "../view.js";
import { asyncHandler, bodyString } from "../validate.js";

const router = express.Router();

router.get(
  "/api/staff/overview",
  authRequired,
  requireRole("staff", "admin"),
  asyncHandler(async (req, res) => {
    await reapHolds();
    const db = database();
    const date = (req.query.date || new Date().toISOString().slice(0, 10)).toString();
    const showtimes = db.showtimes
      .map(enrichShowtime)
      .filter((s) => s.startAt.slice(0, 10) === date);
    const showIds = new Set(showtimes.map((s) => s.id));
    const bookings = db.bookings
      .filter((b) => showIds.has(b.showtimeId) || b.createdAt.slice(0, 10) === date)
      .map((b) => enrichBooking(db, b));
    const q = (req.query.q || "").toString().toLowerCase();
    const filtered = q
      ? bookings.filter(
          (b) =>
            b.reference.toLowerCase().includes(q) ||
            b.customer?.email.toLowerCase().includes(q) ||
            b.showtime?.movie?.title.toLowerCase().includes(q)
        )
      : bookings;
    res.json({
      date,
      showtimes,
      bookings: filtered,
      unpaid: filtered.filter((b) => b.status === "held" && b.paymentMethod === "pay_at_cinema"),
      attendance: filtered.filter((b) => b.tickets.some((t) => t.usedAt)),
    });
  })
);

router.post("/api/staff/pay-cash", authRequired, requireRole("staff", "admin"), async (req, res) => {
  const bookingId = bodyString(req.body?.bookingId);
  try {
    const booking = await mutate((db) => {
      expireHolds(db);
      const record = db.bookings.find((b) => b.id === bookingId);
      if (!record) throw new Error("Booking not found");
      if (record.status !== "held") throw new Error("Booking is not unpaid");
      record.status = "confirmed";
      record.paymentMethod = "pay_at_cinema";
      record.paidAt = nowIso();
      record.updatedAt = nowIso();
      record.collectedBy = req.user.id;
      audit(
        db,
        req.user.id,
        "payment.cash",
        `Collected ${record.total} EGP for ${bookingReference(record.id)}`
      );
      return enrichBooking(db, record);
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post(
  "/api/staff/cancel-booking",
  authRequired,
  requireRole("staff", "admin"),
  async (req, res) => {
    const bookingId = bodyString(req.body?.bookingId);
    try {
      const booking = await mutate((db) => {
        expireHolds(db);
        const record = db.bookings.find((b) => b.id === bookingId);
        if (!record) throw new Error("Booking not found");
        if (record.status === "cancelled") throw new Error("Already cancelled");
        record.status = "cancelled";
        record.updatedAt = nowIso();
        record.cancelledBy = req.user.id;
        audit(db, req.user.id, "booking.cancel", bookingReference(record.id));
        return enrichBooking(db, record);
      });
      res.json(booking);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.post("/api/staff/validate", authRequired, requireRole("staff", "admin"), async (req, res) => {
  const { qr, reference, ticketId } = req.body || {};
  try {
    const result = await mutate((db) => {
      expireHolds(db);
      let tickets = [];
      if (qr) {
        const token = String(qr).replace(/^TICKET:/, "");
        const ticket = db.tickets.find((t) => t.qrToken === token);
        if (!ticket) throw new Error("QR code not recognized");
        tickets = [ticket];
      } else if (ticketId) {
        const ticket = db.tickets.find((t) => t.id === ticketId);
        if (!ticket) throw new Error("Ticket not found");
        tickets = [ticket];
      } else if (reference) {
        const ref = String(reference).trim().toUpperCase();
        const booking = db.bookings.find(
          (b) => bookingReference(b.id) === ref || b.id === reference
        );
        if (!booking) throw new Error("Booking reference not found");
        tickets = db.tickets.filter((t) => t.bookingId === booking.id);
      } else {
        throw new Error("Provide a QR code or booking reference");
      }
      const booking = db.bookings.find((b) => b.id === tickets[0].bookingId);
      if (booking.status !== "confirmed") throw new Error("Booking is not confirmed");
      if (ticketId || qr) {
        if (tickets[0].usedAt) throw new Error("This ticket was already used");
        tickets[0].usedAt = nowIso();
        audit(db, req.user.id, "ticket.validate", `Seat ${tickets[0].seatId}`);
      }
      return {
        booking: enrichBooking(db, booking),
        checkedIn: Boolean(qr || ticketId),
        message:
          qr || ticketId
            ? "Ticket admitted"
            : "Booking found. Check in one ticket at a time by ticket id or QR.",
      };
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
