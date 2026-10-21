import express from "express";
import { getDb, mutate } from "../store.js";
import { hashPassword, authRequired, requireRole } from "../auth.js";
import {
  nowIso,
  audit,
  publicUser,
  buildSeatIds,
  reapHolds,
} from "../helpers.js";
import { enrichShowtime, enrichBooking, hallConflicts, database } from "../view.js";
import {
  asyncHandler,
  requireFields,
  bodyString,
  numberInRange,
} from "../validate.js";

const router = express.Router();
router.use(authRequired, requireRole("admin"));

function movieInput(body, { partial = false } = {}) {
  const out = {};
  if (body.title !== undefined || !partial) out.title = bodyString(body.title);
  if (body.description !== undefined) out.description = bodyString(body.description);
  if (body.poster !== undefined) out.poster = bodyString(body.poster);
  if (body.genre !== undefined) out.genre = bodyString(body.genre);
  if (body.durationMinutes !== undefined) {
    out.durationMinutes = numberInRange(body.durationMinutes, "durationMinutes", 1, 600);
  }
  if (body.ageRating !== undefined) out.ageRating = bodyString(body.ageRating);
  if (body.language !== undefined) out.language = bodyString(body.language);
  return out;
}

function showtimeConflicts(db, hallId, start, durationMinutes, exceptId = null) {
  return hallConflicts(db, hallId, start, new Date(start.getTime() + durationMinutes * 60 * 1000), exceptId);
}

router.get("/api/admin/users", (_req, res) => {
  res.json(getDb().users.map(publicUser));
});

router.post("/api/admin/users", async (req, res) => {
  try {
    requireFields(["fullName", "email", "password", "role"], req.body);
    const fullName = bodyString(req.body.fullName);
    const email = bodyString(req.body.email);
    const password = String(req.body.password);
    const role = bodyString(req.body.role);
    if (!["staff", "admin"].includes(role)) throw new Error("Role must be staff or admin");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
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

router.post("/api/admin/movies", async (req, res) => {
  try {
    const input = movieInput(req.body || {});
    if (!input.title) throw new Error("Title is required");
    const movie = await mutate((db) => {
      const record = {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description || "",
        poster: input.poster || "https://picsum.photos/seed/newmovie/400/600",
        genre: input.genre || "General",
        durationMinutes: input.durationMinutes || 120,
        ageRating: input.ageRating || "PG",
        language: input.language || "English",
      };
      db.movies.push(record);
      audit(db, req.user.id, "movie.create", record.title);
      return record;
    });
    res.status(201).json(movie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/api/admin/movies/:id", async (req, res) => {
  try {
    const input = movieInput(req.body || {}, { partial: true });
    const movie = await mutate((db) => {
      const record = db.movies.find((m) => m.id === req.params.id);
      if (!record) throw new Error("Movie not found");
      Object.assign(record, input);
      audit(db, req.user.id, "movie.update", record.title);
      return record;
    });
    res.json(movie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/api/admin/movies/:id", async (req, res) => {
  try {
    await mutate((db) => {
      const index = db.movies.findIndex((m) => m.id === req.params.id);
      if (index === -1) throw new Error("Movie not found");
      const title = db.movies[index].title;
      const hasShowtimes = db.showtimes.some((s) => s.movieId === req.params.id);
      if (hasShowtimes) {
        throw new Error("Cannot delete a movie that has showtimes. Cancel the showtimes first.");
      }
      db.movies.splice(index, 1);
      audit(db, req.user.id, "movie.delete", title);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/api/admin/halls", (_req, res) => {
  res.json(getDb().halls);
});

router.put("/api/admin/halls/:id", async (req, res) => {
  try {
    const body = req.body || {};
    const hall = await mutate((db) => {
      const record = db.halls.find((h) => h.id === req.params.id);
      if (!record) throw new Error("Hall not found");
      const rows = body.rows !== undefined ? numberInRange(body.rows, "rows", 1, 40) : record.rows;
      const seatsPerRow =
        body.seatsPerRow !== undefined
          ? numberInRange(body.seatsPerRow, "seatsPerRow", 1, 60)
          : record.seatsPerRow;
      const layoutIds = new Set(buildSeatIds({ rows, seatsPerRow, vipSeats: [] }));
      let vipSeats = record.vipSeats;
      if (Array.isArray(body.vipSeats)) {
        vipSeats = [...new Set(body.vipSeats.map((s) => String(s)))].filter((s) => layoutIds.has(s));
      } else {
        vipSeats = vipSeats.filter((s) => layoutIds.has(s));
      }
      const activeTickets = db.tickets.filter((t) => {
        const booking = db.bookings.find((b) => b.id === t.bookingId);
        return (
          booking &&
          (booking.status === "held" || booking.status === "confirmed") &&
          db.showtimes.find((s) => s.id === booking.showtimeId)?.hallId === record.id
        );
      });
      for (const ticket of activeTickets) {
        if (!layoutIds.has(ticket.seatId)) {
          throw new Error(
            `Cannot shrink layout: seat ${ticket.seatId} has active bookings`
          );
        }
      }
      if (body.name !== undefined) record.name = bodyString(body.name) || record.name;
      record.rows = rows;
      record.seatsPerRow = seatsPerRow;
      record.vipSeats = vipSeats;
      audit(db, req.user.id, "hall.update", record.name);
      return record;
    });
    res.json(hall);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/admin/showtimes", async (req, res) => {
  const { movieId, hallId, startAt } = req.body || {};
  try {
    const priceStandard = numberInRange(
      req.body?.priceStandard ?? 100,
      "priceStandard",
      1,
      10000
    );
    const priceVip = numberInRange(req.body?.priceVip ?? 160, "priceVip", 1, 10000);
    const showtime = await mutate((db) => {
      const movie = db.movies.find((m) => m.id === movieId);
      const hall = db.halls.find((h) => h.id === hallId);
      if (!movie || !hall) throw new Error("Movie and hall are required");
      const start = new Date(startAt);
      if (Number.isNaN(start.getTime())) throw new Error("Invalid start time");
      if (showtimeConflicts(db, hallId, start, movie.durationMinutes)) {
        throw new Error("Overlapping screening in this hall");
      }
      const record = {
        id: crypto.randomUUID(),
        movieId,
        hallId,
        startAt: start.toISOString(),
        status: "scheduled",
        priceStandard,
        priceVip,
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

router.put("/api/admin/showtimes/:id", async (req, res) => {
  try {
    const body = req.body || {};
    const showtime = await mutate((db) => {
      const record = db.showtimes.find((s) => s.id === req.params.id);
      if (!record) throw new Error("Showtime not found");
      if (body.priceStandard !== undefined) {
        record.priceStandard = numberInRange(body.priceStandard, "priceStandard", 1, 10000);
      }
      if (body.priceVip !== undefined) {
        record.priceVip = numberInRange(body.priceVip, "priceVip", 1, 10000);
      }
      if (body.startAt) {
        const start = new Date(body.startAt);
        if (Number.isNaN(start.getTime())) throw new Error("Invalid start time");
        const movie = db.movies.find((m) => m.id === record.movieId);
        if (
          showtimeConflicts(db, record.hallId, start, movie?.durationMinutes || 120, record.id)
        ) {
          throw new Error("Overlapping screening in this hall");
        }
        record.startAt = start.toISOString();
      }
      audit(db, req.user.id, "showtime.update", record.id);
      return enrichShowtime(record);
    });
    res.json(showtime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/admin/showtimes/:id/cancel", async (req, res) => {
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

router.get("/api/admin/settings", (_req, res) => {
  res.json(getDb().settings);
});

router.put("/api/admin/settings", async (req, res) => {
  try {
    const body = req.body || {};
    const current = getDb().settings;
    const hold =
      body.reservationHoldMinutes !== undefined
        ? numberInRange(body.reservationHoldMinutes, "reservationHoldMinutes", 1, 1440)
        : current.reservationHoldMinutes;
    const max =
      body.maxTicketsPerBooking !== undefined
        ? numberInRange(body.maxTicketsPerBooking, "maxTicketsPerBooking", 1, 30)
        : current.maxTicketsPerBooking;
    if (!Number.isInteger(hold) || !Number.isInteger(max)) {
      throw new Error("Settings must be whole numbers");
    }
    const settings = await mutate((db) => {
      db.settings.reservationHoldMinutes = hold;
      db.settings.maxTicketsPerBooking = max;
      audit(db, req.user.id, "settings.update", JSON.stringify(db.settings));
      return db.settings;
    });
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get(
  "/api/admin/reports",
  asyncHandler(async (_req, res) => {
    await reapHolds();
    const db = database();
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
        ticketsSold: db.tickets.filter((t) => confirmed.some((b) => b.id === t.bookingId)).length,
        attendance,
      },
      cancelledBookings: cancelled.map((b) => enrichBooking(db, b)),
      moviePerformance: Object.values(byMovie),
      staffActivity,
      audit: db.audit.slice(0, 100),
    });
  })
);

router.get("/api/admin/audit", (_req, res) => {
  const db = getDb();
  res.json(
    db.audit.slice(0, 200).map((a) => {
      const user = db.users.find((u) => u.id === a.userId);
      return { ...a, user: user ? publicUser(user) : null };
    })
  );
});

export default router;
