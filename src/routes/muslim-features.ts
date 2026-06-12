import type { Response } from "express";
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getOwnedTrip, resolveTripCoordinates } from "../lib/trip-utils.js";
import { getPrayerTimings } from "../services/aladhan.js";
import {
  findNearbyActivities,
  findNearbyHalal,
  findNearbyMosques,
} from "../services/places.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

function requireDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

async function getTripCoordsOrError(req: AuthRequest, res: Response) {
  const tripId = req.params.tripId as string;
  const trip = await getOwnedTrip(tripId, req.user!.id);
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return null;
  }

  const coords = resolveTripCoordinates(trip);
  if (!coords) {
    res.status(400).json({
      error:
        "Add at least one location to this trip before using Muslim-friendly features.",
    });
    return null;
  }

  return { trip, coords };
}

// GET /api/trips/:tripId/prayer-times?date=YYYY-MM-DD
router.get("/prayer-times", async (req: AuthRequest, res) => {
  try {
    const date = requireDate(req.query.date);
    if (!date) {
      res.status(400).json({ error: "date query required (YYYY-MM-DD)" });
      return;
    }

    const context = await getTripCoordsOrError(req, res);
    if (!context) return;

    const timings = await getPrayerTimings(
      context.coords.latitude,
      context.coords.longitude,
      date,
    );
    res.json(timings);
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: (e as Error).message ?? "Failed to fetch prayer times" });
  }
});

// GET /api/trips/:tripId/nearby/mosques?radius=5000
router.get("/nearby/mosques", async (req: AuthRequest, res) => {
  try {
    const context = await getTripCoordsOrError(req, res);
    if (!context) return;

    const radius = Number(req.query.radius) || 5000;
    const places = await findNearbyMosques(
      context.coords.latitude,
      context.coords.longitude,
      radius,
    );

    res.json(places);
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: (e as Error).message ?? "Failed to fetch mosques" });
  }
});

// GET /api/trips/:tripId/nearby/halal?radius=5000
router.get("/nearby/halal", async (req: AuthRequest, res) => {
  try {
    const context = await getTripCoordsOrError(req, res);
    if (!context) return;

    const radius = Number(req.query.radius) || 5000;
    const places = await findNearbyHalal(
      context.coords.latitude,
      context.coords.longitude,
      radius,
    );

    res.json(places);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: (e as Error).message ?? "Failed to fetch Halal restaurants",
    });
  }
});

// GET /api/trips/:tripId/activity-recommendations?radius=5000
router.get("/activity-recommendations", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const trip = await getOwnedTrip(tripId, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    if (trip.locations.length === 0) {
      res.status(400).json({
        error: "Add at least one location to this trip before getting recommendations.",
      });
      return;
    }

    const radius = Number(req.query.radius) || 5000;
    const rows = await Promise.all(
      trip.locations.slice(0, 5).map(async (location) => {
        try {
          const recommendations = await findNearbyActivities(
            location.latitude,
            location.longitude,
            radius,
          );

          return {
            sourceLocation: {
              id: location.id,
              title: location.locationTitle,
              latitude: location.latitude,
              longitude: location.longitude,
            },
            recommendations,
            error: null,
          };
        } catch (e) {
          return {
            sourceLocation: {
              id: location.id,
              title: location.locationTitle,
              latitude: location.latitude,
              longitude: location.longitude,
            },
            recommendations: [],
            error: (e as Error).message,
          };
        }
      }),
    );

    res.json({
      radius,
      source: "Google Places live search",
      note: "Recommendations are based on the first 5 saved trip locations and are not stored until added as activities.",
      rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: (e as Error).message ?? "Failed to fetch activity recommendations",
    });
  }
});

export default router;
