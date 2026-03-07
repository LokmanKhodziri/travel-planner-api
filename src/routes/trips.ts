import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { geocodeAddress } from "../services/geocode.js";

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
      where: { id: req.params.id, userId: req.user!.id },
      include: { locations: { orderBy: { order: "asc" } } },
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

// POST /api/trips/:tripId/locations – add location (body: { address })
router.post("/:tripId/locations", async (req: AuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ error: "address required" });
      return;
    }
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.id },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    const { latitude, longitude } = await geocodeAddress(address);
    const count = await prisma.location.count({ where: { tripId } });
    const location = await prisma.location.create({
      data: {
        locationTitle: address,
        tripId,
        latitude,
        longitude,
        order: count,
      },
    });
    res.status(201).json(location);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to add location" });
  }
});

export default router;
