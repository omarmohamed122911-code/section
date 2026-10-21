import { getDb } from "./store.js";
import {
  movieById,
  hallById,
  showtimeById,
  derivedShowStatus,
  bookingReference,
  publicUser,
} from "./helpers.js";

export function enrichShowtime(showtime) {
  const movie = movieById(showtime.movieId);
  const hall = hallById(showtime.hallId);
  return {
    ...showtime,
    status: derivedShowStatus(showtime),
    movie,
    hall: hall ? { id: hall.id, name: hall.name } : null,
  };
}

export function enrichBooking(db, booking) {
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

export function hasAttended(db, userId, showtimeId) {
  const bookings = db.bookings.filter(
    (b) => b.userId === userId && b.showtimeId === showtimeId && b.status === "confirmed"
  );
  if (!bookings.length) return false;
  const showtime = showtimeById(showtimeId);
  if (showtime && derivedShowStatus(showtime) === "completed") return true;
  const ids = new Set(bookings.map((b) => b.id));
  return db.tickets.some((t) => ids.has(t.bookingId) && t.usedAt);
}

export function hallConflicts(db, hallId, start, end, exceptShowtimeId = null) {
  return db.showtimes.some((s) => {
    if (s.hallId !== hallId) return false;
    if (s.status === "cancelled") return false;
    if (exceptShowtimeId && s.id === exceptShowtimeId) return false;
    const otherMovie = db.movies.find((m) => m.id === s.movieId);
    const otherStart = new Date(s.startAt);
    const otherEnd = new Date(
      otherStart.getTime() + (otherMovie?.durationMinutes || 120) * 60 * 1000
    );
    return start < otherEnd && otherStart < end;
  });
}

export function database() {
  return getDb();
}
