import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import "./config/passport.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import tripsRoutes from "./routes/trips.js";
import locationsRoutes from "./routes/locations.js";
import muslimFeaturesRoutes from "./routes/muslim-features.js";
import activitiesRoutes from "./routes/activities.js";
import placesRoutes from "./routes/places.js";
import adminRoutes from "./routes/admin.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const allowedOrigins = new Set(
  [
    FRONTEND_URL,
    ...(process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ].filter(Boolean),
);

function isAllowedVercelPreview(origin: string) {
  const previewPattern = process.env.VERCEL_PREVIEW_ORIGIN_REGEX;
  if (!previewPattern) return false;

  try {
    return new RegExp(previewPattern).test(origin);
  } catch {
    console.warn("Invalid VERCEL_PREVIEW_ORIGIN_REGEX value");
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isAllowedVercelPreview(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

// Auth (OAuth + logout)
app.use("/auth", authRoutes);

// API
app.use("/api/auth/me", meRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/trips/:tripId", muslimFeaturesRoutes);
app.use("/api/trips/:tripId/activities", activitiesRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/admin", adminRoutes);

// Health
app.get("/health", (_, res) => res.json({ ok: true }));

export default app;
