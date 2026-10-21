import express from "express";
import { mutate } from "../store.js";
import { authRequired, requireRole } from "../auth.js";
import { nowIso, showtimeById, audit } from "../helpers.js";
import { hasAttended } from "../view.js";
import { bodyString } from "../validate.js";

const router = express.Router();

router.post("/api/reviews", authRequired, requireRole("customer"), async (req, res) => {
  const showtimeId = bodyString(req.body?.showtimeId);
  const value = Number(req.body?.rating);
  const comment = bodyString(req.body?.comment).slice(0, 1000);
  if (!showtimeId || !Number.isFinite(value) || value < 1 || value > 5) {
    return res.status(400).json({ error: "Showtime and rating 1-5 are required" });
  }
  try {
    const review = await mutate((db) => {
      const showtime = showtimeById(showtimeId);
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
        comment,
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

export default router;
