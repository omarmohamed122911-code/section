import { getDb, saveDb } from "./store.js";

export function nowIso() {
  return new Date().toISOString();
}

export function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60 * 1000).toISOString();
}

export function seatLabel(rowIndex, seatIndex) {
  return `${String.fromCharCode(65 + rowIndex)}${seatIndex + 1}`;
}

export function buildSeatIds(hall) {
  const ids = [];
  for (let r = 0; r < hall.rows; r += 1) {
    for (let s = 0; s < hall.seatsPerRow; s += 1) {
      ids.push(seatLabel(r, s));
    }
  }
  return ids;
}

export function seatCategory(hall, seatId) {
  return hall.vipSeats.includes(seatId) ? "vip" : "standard";
}

export function ticketTypeMultiplier(type) {
  if (type === "child") return 0.7;
  if (type === "student") return 0.8;
  return 1;
}

export function unitPrice(showtime, category, ticketType) {
  const base = category === "vip" ? showtime.priceVip : showtime.priceStandard;
  return Math.round(base * ticketTypeMultiplier(ticketType));
}

export function movieById(id) {
  return getDb().movies.find((m) => m.id === id);
}

export function hallById(id) {
  return getDb().halls.find((h) => h.id === id);
}

export function showtimeById(id) {
  return getDb().showtimes.find((s) => s.id === id);
}

export function showEnd(showtime) {
  const movie = movieById(showtime.movieId);
  const duration = movie?.durationMinutes || 120;
  return new Date(new Date(showtime.startAt).getTime() + duration * 60 * 1000);
}

export function derivedShowStatus(showtime) {
  if (showtime.status === "cancelled") return "cancelled";
  const start = new Date(showtime.startAt);
  const end = showEnd(showtime);
  const now = new Date();
  if (now < start) return "scheduled";
  if (now <= end) return "active";
  return "completed";
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function expireHolds(db) {
  const now = Date.now();
  const expired = [];
  for (const booking of db.bookings) {
    if (booking.status === "held" && new Date(booking.holdExpiresAt).getTime() <= now) {
      booking.status = "expired";
      booking.updatedAt = nowIso();
      expired.push(booking.id);
    }
  }
  return expired;
}

export function takenSeats(db, showtimeId, exceptBookingId = null) {
  const taken = new Set();
  const activeBookings = db.bookings.filter(
    (b) =>
      b.showtimeId === showtimeId &&
      (b.status === "held" || b.status === "confirmed") &&
      b.id !== exceptBookingId
  );
  const activeIds = new Set(activeBookings.map((b) => b.id));
  for (const ticket of db.tickets) {
    if (activeIds.has(ticket.bookingId)) taken.add(ticket.seatId);
  }
  return taken;
}

export function audit(db, userId, action, details) {
  db.audit.unshift({
    id: crypto.randomUUID(),
    userId,
    action,
    details,
    createdAt: nowIso(),
  });
}

export function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

export function bookingReference(id) {
  return `CN-${id.slice(0, 8).toUpperCase()}`;
}

export async function reapHolds() {
  const db = getDb();
  const expired = expireHolds(db);
  if (expired.length > 0) await saveDb();
  return expired;
}
