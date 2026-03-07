import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getCountyFromCoordinates } from "../services/geocode.js";

const router = Router();

router.use(requireAuth);

export interface TransformedLocation {
  name: string;
  latitude: number;
  longitude: number;
  county?: string;
}

// GET /api/locations – all locations for current user (for globe)
router.get("/", async (req: AuthRequest, res) => {
  try {
    const locations = await prisma.location.findMany({
      where: { trip: { userId: req.user!.id } },
      select: {
        locationTitle: true,
        latitude: true,
        longitude: true,
        trip: { select: { title: true } },
      },
    });
    const transformed: TransformedLocation[] = await Promise.all(
      locations.map(async (loc) => {
        const geo = await getCountyFromCoordinates(loc.latitude, loc.longitude);
        return {
          name: `${loc.trip.title} - ${geo.formattedAddress}`,
          latitude: loc.latitude,
          longitude: loc.longitude,
          county: geo.county || undefined,
        };
      })
    );
    res.json(transformed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// DELETE /api/locations/:id – delete location (query: tripId for ownership)
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tripId = req.query.tripId as string;
    if (!tripId) {
      res.status(400).json({ error: "tripId query required" });
      return;
    }
    const location = await prisma.location.findFirst({
      where: { id, tripId, trip: { userId: req.user!.id } },
    });
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    await prisma.location.delete({ where: { id } });
    const remaining = await prisma.location.findMany({
      where: { tripId },
      orderBy: { order: "asc" },
    });
    await Promise.all(
      remaining.map((loc, index) =>
        prisma.location.update({ where: { id: loc.id }, data: { order: index } })
      )
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete location" });
  }
});

// PATCH /api/locations/reorder – body: { tripId, locationIds: string[] }
router.patch("/reorder", async (req: AuthRequest, res) => {
  try {
    const { tripId, locationIds } = req.body;
    if (!tripId || !Array.isArray(locationIds)) {
      res.status(400).json({ error: "tripId and locationIds required" });
      return;
    }
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.id },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    await Promise.all(
      locationIds.map((locationId: string, index: number) =>
        prisma.location.updateMany({
          where: { id: locationId, tripId },
          data: { order: index },
        })
      )
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reorder locations" });
  }
});

export default router;
