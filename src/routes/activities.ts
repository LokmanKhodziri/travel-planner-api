import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { geocodeAddress } from "../services/geocode.js";
import { getSmartTravelEstimate, parseTravelMode } from "../services/distance-matrix.js";
import { ensureTripLocation } from "../lib/trip-utils.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

function parseOptionalCoordinate(value: unknown) {
  if (value == null || value === "") return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function activityDateKey(activity: { startTime: Date }) {
  return activity.startTime.toISOString().slice(0, 10);
}

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
    const { title, description, startTime, endTime, address } = req.body;
    const latitude = parseOptionalCoordinate(req.body.latitude);
    const longitude = parseOptionalCoordinate(req.body.longitude);

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

    let resolvedLatitude = latitude;
    let resolvedLongitude = longitude;
    const trimmedAddress =
      typeof address === "string" ? address.trim() : "";

    if (
      trimmedAddress &&
      (resolvedLatitude == null || resolvedLongitude == null)
    ) {
      try {
        const geocoded = await geocodeAddress(trimmedAddress);
        resolvedLatitude = geocoded.latitude;
        resolvedLongitude = geocoded.longitude;
      } catch (geocodeError) {
        console.error(geocodeError);
      }
    }

    const count = await prisma.itineraryActivity.count({ where: { tripId } });
    const activity = await prisma.itineraryActivity.create({
      data: {
        title,
        description: description ?? null,
        address: trimmedAddress || null,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        startTime: start,
        endTime: end,
        order: count,
        tripId,
      },
    });

    const syncedLocation = await ensureTripLocation(tripId, {
      locationTitle: title,
      address: trimmedAddress || null,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    });

    res.status(201).json({ ...activity, syncedLocation });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// GET /api/trips/:tripId/activities/travel-times?date=YYYY-MM-DD&mode=driving|transit|walking
router.get("/travel-times", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const date = typeof req.query.date === "string" ? req.query.date : null;
    const preferredMode = parseTravelMode(req.query.mode);

    const activities = await prisma.itineraryActivity.findMany({
      where: { tripId, trip: { userId: req.user!.id } },
      orderBy: { startTime: "asc" },
    });
    const dayActivities = date
      ? activities.filter((activity) => activityDateKey(activity) === date)
      : activities;

    const segments = await Promise.all(
      dayActivities.slice(0, -1).map(async (fromActivity, index) => {
        const toActivity = dayActivities[index + 1];
        const baseSegment = {
          fromActivityId: fromActivity.id,
          fromTitle: fromActivity.title,
          toActivityId: toActivity.id,
          toTitle: toActivity.title,
        };

        if (
          fromActivity.latitude == null ||
          fromActivity.longitude == null ||
          toActivity.latitude == null ||
          toActivity.longitude == null
        ) {
          return {
            ...baseSegment,
            estimate: null,
            error:
              "Travel time needs coordinates. Add activities from recommendations to calculate it.",
          };
        }

        try {
          const estimate = await getSmartTravelEstimate(
            {
              latitude: fromActivity.latitude,
              longitude: fromActivity.longitude,
            },
            {
              latitude: toActivity.latitude,
              longitude: toActivity.longitude,
            },
            preferredMode,
          );

          return { ...baseSegment, estimate, error: null };
        } catch (e) {
          return {
            ...baseSegment,
            estimate: null,
            error: (e as Error).message,
          };
        }
      }),
    );

    res.json({ date, mode: preferredMode, segments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch travel times" });
  }
});

// PATCH /api/trips/:tripId/activities/:activityId
router.patch("/:activityId", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const { activityId } = req.params;
    const { title, description, startTime, endTime, address } = req.body;

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
        address: address ?? existing.address,
        latitude:
          req.body.latitude === undefined
            ? existing.latitude
            : parseOptionalCoordinate(req.body.latitude),
        longitude:
          req.body.longitude === undefined
            ? existing.longitude
            : parseOptionalCoordinate(req.body.longitude),
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
