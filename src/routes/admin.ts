import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.use(requireAdmin);

router.get("/summary", async (_req, res) => {
  try {
    const [users, trips, locations, activities, activeSessions] = await Promise.all([
      prisma.user.count(),
      prisma.trip.count(),
      prisma.location.count(),
      prisma.itineraryActivity.count(),
      prisma.session.count({ where: { expires: { gt: new Date() } } }),
    ]);

    res.json({ users, trips, locations, activities, activeSessions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load admin summary" });
  }
});

router.get("/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        _count: {
          select: { trip: true, sessions: true },
        },
      },
    });

    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.get("/trips", async (_req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: { createAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        createAt: true,
        user: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { locations: true, activities: true },
        },
      },
    });

    res.json(trips);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load trips" });
  }
});

export default router;
