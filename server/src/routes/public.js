import express from "express";
import { getDb } from "../store.js";
import {
  seatCategory,
  buildSeatIds,
  movieById,
  hallById,
  showtimeById,
  takenSeats,
  reapHolds,
} from "../helpers.js";
import { enrichShowtime, database } from "../view.js";
import { asyncHandler } from "../validate.js";

const router = express.Router();

router.get("/api/health", (_req, res) => res.json({ ok: true }));

router.get("/api/settings/public", (_req, res) => {
  const { reservationHoldMinutes, maxTicketsPerBooking } = getDb().settings;
  res.json({ reservationHoldMinutes, maxTicketsPerBooking, currency: "EGP" });
});

router.get("/api/movies", (req, res) => {
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

router.get("/api/movies/:id", (req, res) => {
  const movie = movieById(req.params.id);
  if (!movie) return res.status(404).json({ error: "Movie not found" });
  const reviews = getDb().reviews.filter((r) => r.movieId === movie.id);
  const avg =
    reviews.length === 0
      ? null
      : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
  res.json({ ...movie, reviews, averageRating: avg });
});

router.get(
  "/api/showtimes",
  asyncHandler(async (req, res) => {
    await reapHolds();
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
  })
);

router.get(
  "/api/showtimes/:id/seats",
  asyncHandler(async (req, res) => {
    await reapHolds();
    const db = database();
    const showtime = showtimeById(req.params.id);
    if (!showtime) return res.status(404).json({ error: "Showtime not found" });
    const hall = hallById(showtime.hallId);
    if (!hall) return res.status(500).json({ error: "Hall not found" });
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
  })
);

export default router;
