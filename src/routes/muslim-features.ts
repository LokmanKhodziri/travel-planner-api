import type { Response } from "express";
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getOwnedTrip, resolveTripCoordinates } from "../lib/trip-utils.js";
import { getPrayerTimings } from "../services/aladhan.js";
import { findNearbyHalal, findNearbyMosques } from "../services/places.js";

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
    console.log(
      `[nearby/mosques] trip=${context.trip.id} user=${req.user?.id} coords=${context.coords.latitude},${context.coords.longitude} radius=${radius}`,
    );
    const places = await findNearbyMosques(
      context.coords.latitude,
      context.coords.longitude,
      radius,
    );
    console.log(`[nearby/mosques] results=${places.length}`);
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
    console.log(
      `[nearby/halal] trip=${context.trip.id} user=${req.user?.id} coords=${context.coords.latitude},${context.coords.longitude} radius=${radius}`,
    );
    const places = await findNearbyHalal(
      context.coords.latitude,
      context.coords.longitude,
      radius,
    );
    console.log(`[nearby/halal] results=${places.length}`);
    res.json(places);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: (e as Error).message ?? "Failed to fetch Halal restaurants",
    });
  }
});

export default router;
