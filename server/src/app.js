import express from "express";
import cors from "cors";
import publicRoutes from "./routes/public.js";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import reviewRoutes from "./routes/reviews.js";
import staffRoutes from "./routes/staff.js";
import adminRoutes from "./routes/admin.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  app.use(publicRoutes);
  app.use(authRoutes);
  app.use(bookingRoutes);
  app.use(reviewRoutes);
  app.use(staffRoutes);
  app.use(adminRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

  return app;
}
