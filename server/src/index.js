import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import qrcode from "qrcode";
import { loadDb, getDb, mutate } from "./store.js";
import { buildSeed } from "./seed.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  authRequired,
  requireRole,
} from "./auth.js";
import {
  nowIso,
  addMinutes,
  seatCategory,
  unitPrice,
  movieById,
  hallById,
  showtimeById,
  showEnd,
  derivedShowStatus,
  rangesOverlap,
  expireHolds,
  takenSeats,
  audit,
  publicUser,
  bookingReference,
  buildSeatIds,
} from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

loadDb();
if (getDb().users.length === 0) {
  const seeded = buildSeed();
  Object.assign(getDb(), seeded);
  fs.writeFileSync(
    path.join(__dirname, "..", "data", "db.json"),
    JSON.stringify(getDb(), null, 2)
  );
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

setInterval(() => {
  mutate((db) => expireHolds(db)).catch(() => {});
}, 30 * 1000);

function enrichShowtime(showtime) {
  const movie = movieById(showtime.movieId);
  const hall = hallById(showtime.hallId);
  return {
    ...showtime,
    status: derivedShowStatus(showtime),
    movie,
    hall: hall ? { id: hall.id, name: hall.name } : null,
  };
}

function enrichBooking(db, booking) {
  const tickets = db.tickets.filter((t) => t.bookingId === booking.id);
  const showtime = showtimeById(booking.showtimeId);
  const user = db.users.find((u) => u.id === booking.userId);
  return {
    ...booking,
    reference: bookingReference(booking.id),
    tickets,
    showtime: showtime ? enrichShowtime(showtime) : null,
    customer: user ? publicUser(user) : null,
  };
}

function hasAttended(db, userId, showtimeId) {
  const bookings = db.bookings.filter(
    (b) => b.userId === userId && b.showtimeId === showtimeId && b.status === "confirmed"
  );
  if (!bookings.length) return false;
  const showtime = showtimeById(showtimeId);
  if (showtime && derivedShowStatus(showtime) === "completed") return true;
  const ids = new Set(bookings.map((b) => b.id));
  return db.tickets.some((t) => ids.has(t.bookingId) && t.usedAt);
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/settings/public", (_req, res) => {
  const { reservationHoldMinutes, maxTicketsPerBooking } = getDb().settings;
  res.json({ reservationHoldMinutes, maxTicketsPerBooking, currency: "EGP" });
});

app.get("/api/movies", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase();
  const genre = (req.query.genre || "").toString().toLowerCase();
  let movies = getDb().movies;
  if (q) {
    movies = movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q)
    );
  }
  if (genre) movies = movies.filter((m) => m.genre.toLowerCase() === genre);
  res.json(movies);
});

app.get("/api/movies/:id", (req, res) => {
  const movie = movieById(req.params.id);
  if (!movie) return res.status(404).json({ error: "Movie not found" });
  const reviews = getDb().reviews.filter((r) => r.movieId === movie.id);
  const avg =
    reviews.length === 0
      ? null
      : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
  res.json({ ...movie, reviews, averageRating: avg });
});

app.get("/api/showtimes", (req, res) => {
  expireHolds(getDb());
  const movieId = req.query.movieId;
  let list = getDb().showtimes.map(enrichShowtime);
  if (movieId) list = list.filter((s) => s.movieId === movieId);
  const q = (req.query.q || "").toString().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        s.movie?.title.toLowerCase().includes(q) ||
        s.hall?.name.toLowerCase().includes(q) ||
        s.status.includes(q)
    );
  }
  list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  res.json(list);
});

app.get("/api/showtimes/:id/seats", (req, res) => {
  const db = getDb();
  expireHolds(db);
  const showtime = showtimeById(req.params.id);
  if (!showtime) return res.status(404).json({ error: "Showtime not found" });
  const hall = hallById(showtime.hallId);
  const taken = takenSeats(db, showtime.id);
  const seats = buildSeatIds(hall).map((id) => ({
    id,
    category: seatCategory(hall, id),
    available: !taken.has(id),
  }));
  res.json({
    showtime: enrichShowtime(showtime),
    hall,
    seats,
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "Full name, email, and password are required" });
  }
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  try {
    const result = await mutate((db) => {
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Email already registered");
      }
      const user = {
        id: crypto.randomUUID(),
        fullName,
        email,
        passwordHash: hashPassword(password),
        role: "customer",
        createdAt: nowIso(),
      };
      db.users.push(user);
      audit(db, user.id, "auth.register", `Customer registered ${email}`);
      return user;
    });
    res.status(201).json({ token: signToken(result), user: publicUser(result) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = getDb().users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/me", authRequired, (req, res) => {
  const user = getDb().users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

app.post("/api/bookings", authRequired, requireRole("customer", "staff", "admin"), async (req, res) => {
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
      if (new Date(showtime.startAt) <= new Date()) throw new Error("Booking is closed for this showtime");
      const hall = db.halls.find((h) => h.id === showtime.hallId);
      const validSeats = new Set(buildSeatIds(hall));
      const taken = takenSeats(db, showtimeId);
      for (const item of seats) {
        if (!validSeats.has(item.seatId)) throw new Error(`Invalid seat ${item.seatId}`);
        if (taken.has(item.seatId)) throw new Error(`Seat ${item.seatId} is not available`);
        if (!["adult", "child", "student"].includes(item.ticketType)) {
          throw new Error("Ticket type must be adult, child, or student");
        }
      }
      let userId = req.user.id;
      if (req.user.role !== "customer") {
        if (!customerEmail) throw new Error("Customer email is required for staff bookings");
        const customer = db.users.find(
          (u) => u.email.toLowerCase() === customerEmail.toLowerCase() && u.role === "customer"
        );
        if (!customer) throw new Error("Customer account not found");
        userId = customer.id;
      }
      const method = paymentMethod === "pay_at_cinema" ? "pay_at_cinema" : "online";
      const bookingId = crypto.randomUUID();
      const tickets = seats.map((item) => {
        const category = seatCategory(hall, item.seatId);
        const price = unitPrice(showtime, category, item.ticketType);
        return {
          id: crypto.randomUUID(),
          bookingId,
          seatId: item.seatId,
          seatCategory: category,
          ticketType: item.ticketType,
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
});

app.post("/api/bookings/:id/pay-demo", authRequired, async (req, res) => {
  const { cardNumber } = req.body || {};
  try {
    const booking = await mutate((db) => {
      expireHolds(db);
      const record = db.bookings.find((b) => b.id === req.params.id);
      if (!record) throw new Error("Booking not found");
      if (record.userId !== req.user.id && req.user.role === "customer") {
        throw new Error("Not your booking");
      }
      if (record.status !== "held") throw new Error("Booking is not awaiting payment");
      const digits = String(cardNumber || "").replace(/\s/g, "");
      if (digits === "4000000000000002") throw new Error("Demo payment declined. Please retry or choose pay at cinema.");
      if (digits.length < 13) throw new Error("Enter a demo card number");
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

app.post("/api/bookings/:id/switch-pay-at-cinema", authRequired, async (req, res) => {
  try {
    const booking = await mutate((db) => {
      expireHolds(db);
      const record = db.bookings.find((b) => b.id === req.params.id);
      if (!record) throw new Error("Booking not found");
      if (record.userId !== req.user.id && req.user.role === "customer") throw new Error("Not your booking");
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

app.get("/api/bookings/mine", authRequired, requireRole("customer"), (req, res) => {
  const db = getDb();
  expireHolds(db);
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
});

app.get("/api/bookings/:id", authRequired, (req, res) => {
  const db = getDb();
  const record = db.bookings.find((b) => b.id === req.params.id);
  if (!record) return res.status(404).json({ error: "Booking not found" });
  if (req.user.role === "customer" && record.userId !== req.user.id) {
    return res.status(403).json({ error: "Not your booking" });
  }
  res.json(enrichBooking(db, record));
});

app.get("/api/tickets/:id/qr", authRequired, async (req, res) => {
  const db = getDb();
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const booking = db.bookings.find((b) => b.id === ticket.bookingId);
  if (req.user.role === "customer" && booking.userId !== req.user.id) {
    return res.status(403).json({ error: "Not your ticket" });
  }
  if (booking.status !== "confirmed") return res.status(400).json({ error: "Ticket is not confirmed" });
  const dataUrl = await qrcode.toDataURL(`TICKET:${ticket.qrToken}`);
  res.json({ dataUrl, token: `TICKET:${ticket.qrToken}` });
});

app.post("/api/reviews", authRequired, requireRole("customer"), async (req, res) => {
  const { showtimeId, rating, comment } = req.body || {};
  const value = Number(rating);
  if (!showtimeId || value < 1 || value > 5) {
    return res.status(400).json({ error: "Showtime and rating 1-5 are required" });
  }
  try {
    const review = await mutate((db) => {
      const showtime = db.showtimes.find((s) => s.id === showtimeId);
      if (!showtime) throw new Error("Showtime not found");
      if (!hasAttended(db, req.user.id, showtimeId)) {
        throw new Error("You can review only after attending this screening");
      }
      if (db.reviews.some((r) => r.userId === req.user.id && r.showtimeId === showtimeId)) {
        throw new Error("You already reviewed this screening");
      }
      const record = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        movieId: showtime.movieId,
        showtimeId,
        rating: value,
        comment: comment || "",
        createdAt: nowIso(),
      };
      db.reviews.push(record);
      audit(db, req.user.id, "review.create", `Rated ${value}/5`);
      return record;
    });
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/staff/overview", authRequired, requireRole("staff", "admin"), (req, res) => {
  const db = getDb();
  expireHolds(db);
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
});

app.post("/api/staff/pay-cash", authRequired, requireRole("staff", "admin"), async (req, res) => {
  const { bookingId } = req.body || {};
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
      audit(db, req.user.id, "payment.cash", `Collected ${record.total} EGP for ${bookingReference(record.id)}`);
      return enrichBooking(db, record);
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/staff/cancel-booking", authRequired, requireRole("staff", "admin"), async (req, res) => {
  const { bookingId } = req.body || {};
  try {
    const booking = await mutate((db) => {
      const record = db.bookings.find((b) => b.id === bookingId);
      if (!record) throw new Error("Booking not found");
      if (record.status === "cancelled") throw new Error("Already cancelled");
      record.status = "cancelled";
      record.updatedAt = nowIso();
      audit(db, req.user.id, "booking.cancel", bookingReference(record.id));
      return enrichBooking(db, record);
    });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/staff/validate", authRequired, requireRole("staff", "admin"), async (req, res) => {
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
        const booking = db.bookings.find((b) => bookingReference(b.id) === ref || b.id === reference);
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
        message: qr || ticketId ? "Ticket admitted" : "Booking found. Check in one ticket at a time.",
      };
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/admin/users", authRequired, requireRole("admin"), (_req, res) => {
  res.json(getDb().users.map(publicUser));
});

app.post("/api/admin/users", authRequired, requireRole("admin"), async (req, res) => {
  const { fullName, email, password, role } = req.body || {};
  if (!fullName || !email || !password) return res.status(400).json({ error: "Missing fields" });
  if (!["staff", "admin"].includes(role)) return res.status(400).json({ error: "Role must be staff or admin" });
  try {
    const user = await mutate((db) => {
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Email already exists");
      }
      const record = {
        id: crypto.randomUUID(),
        fullName,
        email,
        passwordHash: hashPassword(password),
        role,
        createdAt: nowIso(),
      };
      db.users.push(record);
      audit(db, req.user.id, "user.create", `${role} ${email}`);
      return publicUser(record);
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/movies", authRequired, requireRole("admin"), async (req, res) => {
  const { title, description, poster, genre, durationMinutes, ageRating, language } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required" });
  const movie = await mutate((db) => {
    const record = {
      id: crypto.randomUUID(),
      title,
      description: description || "",
      poster: poster || "https://picsum.photos/seed/newmovie/400/600",
      genre: genre || "General",
      durationMinutes: Number(durationMinutes) || 120,
      ageRating: ageRating || "PG",
      language: language || "English",
    };
    db.movies.push(record);
    audit(db, req.user.id, "movie.create", title);
    return record;
  });
  res.status(201).json(movie);
});

app.put("/api/admin/movies/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const movie = await mutate((db) => {
      const record = db.movies.find((m) => m.id === req.params.id);
      if (!record) throw new Error("Movie not found");
      Object.assign(record, req.body);
      record.durationMinutes = Number(record.durationMinutes);
      audit(db, req.user.id, "movie.update", record.title);
      return record;
    });
    res.json(movie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/admin/movies/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    await mutate((db) => {
      const index = db.movies.findIndex((m) => m.id === req.params.id);
      if (index === -1) throw new Error("Movie not found");
      const title = db.movies[index].title;
      db.movies.splice(index, 1);
      audit(db, req.user.id, "movie.delete", title);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/admin/halls", authRequired, requireRole("admin"), (_req, res) => {
  res.json(getDb().halls);
});

app.put("/api/admin/halls/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const hall = await mutate((db) => {
      const record = db.halls.find((h) => h.id === req.params.id);
      if (!record) throw new Error("Hall not found");
      const { name, rows, seatsPerRow, vipSeats } = req.body || {};
      if (name) record.name = name;
      if (rows) record.rows = Number(rows);
      if (seatsPerRow) record.seatsPerRow = Number(seatsPerRow);
      if (Array.isArray(vipSeats)) record.vipSeats = vipSeats;
      audit(db, req.user.id, "hall.update", record.name);
      return record;
    });
    res.json(hall);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/showtimes", authRequired, requireRole("admin"), async (req, res) => {
  const { movieId, hallId, startAt, priceStandard, priceVip } = req.body || {};
  try {
    const showtime = await mutate((db) => {
      const movie = db.movies.find((m) => m.id === movieId);
      const hall = db.halls.find((h) => h.id === hallId);
      if (!movie || !hall) throw new Error("Movie and hall are required");
      const start = new Date(startAt);
      if (Number.isNaN(start.getTime())) throw new Error("Invalid start time");
      const end = new Date(start.getTime() + movie.durationMinutes * 60 * 1000);
      const overlap = db.showtimes.some((s) => {
        if (s.hallId !== hallId || s.status === "cancelled") return false;
        const otherMovie = db.movies.find((m) => m.id === s.movieId);
        const otherEnd = new Date(
          new Date(s.startAt).getTime() + (otherMovie?.durationMinutes || 120) * 60 * 1000
        );
        return rangesOverlap(start, end, new Date(s.startAt), otherEnd);
      });
      if (overlap) throw new Error("Overlapping screening in this hall");
      const record = {
        id: crypto.randomUUID(),
        movieId,
        hallId,
        startAt: start.toISOString(),
        status: "scheduled",
        priceStandard: Number(priceStandard) || 100,
        priceVip: Number(priceVip) || 160,
      };
      db.showtimes.push(record);
      audit(db, req.user.id, "showtime.create", `${movie.title} @ ${record.startAt}`);
      return enrichShowtime(record);
    });
    res.status(201).json(showtime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/admin/showtimes/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const showtime = await mutate((db) => {
      const record = db.showtimes.find((s) => s.id === req.params.id);
      if (!record) throw new Error("Showtime not found");
      if (req.body.priceStandard != null) record.priceStandard = Number(req.body.priceStandard);
      if (req.body.priceVip != null) record.priceVip = Number(req.body.priceVip);
      if (req.body.startAt) record.startAt = new Date(req.body.startAt).toISOString();
      audit(db, req.user.id, "showtime.update", record.id);
      return enrichShowtime(record);
    });
    res.json(showtime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/showtimes/:id/cancel", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const showtime = await mutate((db) => {
      const record = db.showtimes.find((s) => s.id === req.params.id);
      if (!record) throw new Error("Showtime not found");
      record.status = "cancelled";
      const related = db.bookings.filter(
        (b) => b.showtimeId === record.id && (b.status === "held" || b.status === "confirmed")
      );
      for (const booking of related) {
        booking.status = "cancelled";
        booking.updatedAt = nowIso();
        booking.cancelReason = "showtime_cancelled";
      }
      audit(
        db,
        req.user.id,
        "showtime.cancel",
        `Cancelled ${related.length} bookings (demo: no real refund)`
      );
      return enrichShowtime(record);
    });
    res.json(showtime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/admin/settings", authRequired, requireRole("admin"), (_req, res) => {
  res.json(getDb().settings);
});

app.put("/api/admin/settings", authRequired, requireRole("admin"), async (req, res) => {
  const settings = await mutate((db) => {
    if (req.body.reservationHoldMinutes != null) {
      db.settings.reservationHoldMinutes = Number(req.body.reservationHoldMinutes);
    }
    if (req.body.maxTicketsPerBooking != null) {
      db.settings.maxTicketsPerBooking = Number(req.body.maxTicketsPerBooking);
    }
    audit(db, req.user.id, "settings.update", JSON.stringify(db.settings));
    return db.settings;
  });
  res.json(settings);
});

app.get("/api/admin/reports", authRequired, requireRole("admin"), (_req, res) => {
  const db = getDb();
  expireHolds(db);
  const confirmed = db.bookings.filter((b) => b.status === "confirmed");
  const cancelled = db.bookings.filter((b) => b.status === "cancelled" || b.status === "expired");
  const revenue = confirmed.reduce((s, b) => s + b.total, 0);
  const byMovie = {};
  for (const booking of confirmed) {
    const show = db.showtimes.find((s) => s.id === booking.showtimeId);
    const movie = db.movies.find((m) => m.id === show?.movieId);
    const key = movie?.title || "Unknown";
    byMovie[key] = byMovie[key] || { movie: key, bookings: 0, revenue: 0, tickets: 0 };
    byMovie[key].bookings += 1;
    byMovie[key].revenue += booking.total;
    byMovie[key].tickets += db.tickets.filter((t) => t.bookingId === booking.id).length;
  }
  const attendance = db.tickets.filter((t) => t.usedAt).length;
  const staffActivity = db.audit.filter((a) => {
    const user = db.users.find((u) => u.id === a.userId);
    return user?.role === "staff";
  });
  res.json({
    revenue,
    bookingStats: {
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      held: db.bookings.filter((b) => b.status === "held").length,
      ticketsSold: db.tickets.filter((t) =>
        confirmed.some((b) => b.id === t.bookingId)
      ).length,
      attendance,
    },
    cancelledBookings: cancelled.map((b) => enrichBooking(db, b)),
    moviePerformance: Object.values(byMovie),
    staffActivity,
    audit: db.audit.slice(0, 100),
  });
});

app.get("/api/admin/audit", authRequired, requireRole("admin"), (_req, res) => {
  const db = getDb();
  res.json(
    db.audit.slice(0, 200).map((a) => ({
      ...a,
      user: db.users.find((u) => u.id === a.userId)
        ? publicUser(db.users.find((u) => u.id === a.userId))
        : null,
    }))
  );
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`Cinema API running on http://localhost:${PORT}`);
});
