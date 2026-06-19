import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { geocodeAddress } from "../services/geocode.js";
import { ensureTripLocation, syncTripLocationsFromActivities } from "../lib/trip-utils.js";

const router = Router();

router.use(requireAuth);

// GET /api/trips – list trips for current user
router.get("/", async (req: AuthRequest, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.user!.id },
      orderBy: { startDate: "desc" },
    });
    res.json(trips);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});

// GET /api/trips/:id – single trip with locations
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: {
        id: req.params.id,
        ...(req.user!.role === "ADMIN" ? {} : { userId: req.user!.id }),
      },
      include: {
        locations: { orderBy: { order: "asc" } },
        activities: { orderBy: { startTime: "asc" } },
      },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    res.json(trip);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch trip" });
  }
});

// POST /api/trips – create trip
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { title, description, imageUrl, startDate, endDate } = req.body;
    if (!title || !description || !startDate || !endDate) {
      res.status(400).json({ error: "title, description, startDate, endDate required" });
      return;
    }
    const trip = await prisma.trip.create({
      data: {
        title,
        description,
        imageUrl: imageUrl ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId: req.user!.id,
      },
    });
    res.status(201).json(trip);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create trip" });
  }
});

// POST /api/trips/:tripId/locations/sync-from-activities
router.post(
  "/:tripId/locations/sync-from-activities",
  async (req: AuthRequest, res) => {
    try {
      const { tripId } = req.params;
      const locations = await syncTripLocationsFromActivities(
        tripId,
        req.user!.id,
      );
      if (!locations) {
        res.status(404).json({ error: "Trip not found" });
        return;
      }
      res.json(locations);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to sync locations from activities" });
    }
  },
);

// POST /api/trips/:tripId/locations – add location
// body: { address, locationTitle?, latitude?, longitude? }
router.post("/:tripId/locations", async (req: AuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const { address, locationTitle, latitude, longitude } = req.body;
    const hasCoords =
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude);

    if (!address && !hasCoords) {
      res.status(400).json({ error: "address or latitude/longitude required" });
      return;
    }

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.id },
      include: { locations: true },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    let resolvedLat = latitude;
    let resolvedLng = longitude;
    const resolvedTitle =
      (typeof locationTitle === "string" && locationTitle.trim()) ||
      (typeof address === "string" && address.trim()) ||
      "Location";

    if (!hasCoords) {
      const geocoded = await geocodeAddress(address);
      resolvedLat = geocoded.latitude;
      resolvedLng = geocoded.longitude;
    }

    const location = await ensureTripLocation(
      tripId,
      {
        locationTitle: resolvedTitle,
        address,
        latitude: resolvedLat,
        longitude: resolvedLng,
      },
      trip.locations,
    );
    if (!location) {
      res.status(400).json({ error: "Could not resolve location coordinates" });
      return;
    }

    const isNew = !trip.locations.some((loc) => loc.id === location.id);
    res.status(isNew ? 201 : 200).json(location);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to add location" });
  }
});

export default router;
