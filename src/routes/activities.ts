import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

// GET /api/trips/:tripId/activities
router.get("/", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const activities = await prisma.itineraryActivity.findMany({
      where: { tripId, trip: { userId: req.user!.id } },
      orderBy: { startTime: "asc" },
    });
    res.json(activities);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

// POST /api/trips/:tripId/activities
router.post("/", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const { title, description, startTime, endTime } = req.body;

    if (!title || !startTime || !endTime) {
      res
        .status(400)
        .json({ error: "title, startTime and endTime are required" });
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      res.status(400).json({ error: "Invalid activity time range" });
      return;
    }

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.id },
    });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const count = await prisma.itineraryActivity.count({ where: { tripId } });
    const activity = await prisma.itineraryActivity.create({
      data: {
        title,
        description: description ?? null,
        startTime: start,
        endTime: end,
        order: count,
        tripId,
      },
    });

    res.status(201).json(activity);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// PATCH /api/trips/:tripId/activities/:activityId
router.patch("/:activityId", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const { activityId } = req.params;
    const { title, description, startTime, endTime } = req.body;

    const existing = await prisma.itineraryActivity.findFirst({
      where: { id: activityId, tripId, trip: { userId: req.user!.id } },
    });
    if (!existing) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    const start = startTime ? new Date(startTime) : existing.startTime;
    const end = endTime ? new Date(endTime) : existing.endTime;
    if (end <= start) {
      res.status(400).json({ error: "Invalid activity time range" });
      return;
    }

    const activity = await prisma.itineraryActivity.update({
      where: { id: activityId },
      data: {
        title: title ?? existing.title,
        description: description ?? existing.description,
        startTime: start,
        endTime: end,
      },
    });
    res.json(activity);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update activity" });
  }
});

// DELETE /api/trips/:tripId/activities/:activityId
router.delete("/:activityId", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const activityId = req.params.activityId as string;

    const activity = await prisma.itineraryActivity.findFirst({
      where: { id: activityId, tripId },
      include: { trip: true },
    });
    if (!activity || activity.trip.userId !== req.user!.id) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    await prisma.itineraryActivity.delete({ where: { id: activityId } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

export default router;
