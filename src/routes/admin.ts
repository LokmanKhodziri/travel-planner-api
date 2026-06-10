import { Router } from "express";
import { requireAdmin, SESSION_TIMEOUT_MINUTES } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { findNearbyHalal, findNearbyMosques, type NearbyPlace } from "../services/places.js";

const router = Router();

router.use(requireAdmin);

type SourceLocation = {
  id: string;
  locationTitle: string;
  latitude: number;
  longitude: number;
  trip: {
    title: string;
    user: {
      email: string;
      name: string | null;
    };
  };
};

async function getRecentSourceLocations(): Promise<SourceLocation[]> {
  return prisma.location.findMany({
    orderBy: { createAt: "desc" },
    take: 5,
    select: {
      id: true,
      locationTitle: true,
      latitude: true,
      longitude: true,
      trip: {
        select: {
          title: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });
}

async function buildNearbyAdminRows(
  finder: (latitude: number, longitude: number, radius?: number) => Promise<NearbyPlace[]>,
) {
  const sourceLocations = await getRecentSourceLocations();

  return Promise.all(
    sourceLocations.map(async (location) => {
      try {
        const places = await finder(location.latitude, location.longitude, 5000);
        return {
          source: {
            id: location.id,
            title: location.locationTitle,
            latitude: location.latitude,
            longitude: location.longitude,
            tripTitle: location.trip.title,
            userEmail: location.trip.user.email,
            userName: location.trip.user.name,
          },
          places: places.slice(0, 5),
          error: null,
        };
      } catch (e) {
        return {
          source: {
            id: location.id,
            title: location.locationTitle,
            latitude: location.latitude,
            longitude: location.longitude,
            tripTitle: location.trip.title,
            userEmail: location.trip.user.email,
            userName: location.trip.user.name,
          },
          places: [],
          error: (e as Error).message,
        };
      }
    }),
  );
}

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

router.get("/locations", async (_req, res) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createAt: "desc" },
      take: 50,
      select: {
        id: true,
        locationTitle: true,
        latitude: true,
        longitude: true,
        order: true,
        createAt: true,
        trip: {
          select: {
            id: true,
            title: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    res.json(locations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load locations" });
  }
});

router.get("/prayer-facilities", async (_req, res) => {
  try {
    const rows = await buildNearbyAdminRows(findNearbyMosques);
    res.json({
      source: "Google Places live search",
      note: "Prayer facilities are discovered around the 5 most recent saved trip locations and are not stored in the database.",
      rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load prayer facilities" });
  }
});

router.get("/halal-restaurants", async (_req, res) => {
  try {
    const rows = await buildNearbyAdminRows(findNearbyHalal);
    res.json({
      source: "Google Places live search",
      note: "Halal restaurants are discovered around the 5 most recent saved trip locations and are not stored in the database.",
      rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load Halal restaurants" });
  }
});

router.get("/settings", async (_req, res) => {
  res.json({
    sessionTimeoutMinutes: SESSION_TIMEOUT_MINUTES,
    adminEmails: (process.env.ADMIN_EMAILS ?? "admin123@travel.com")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
    apiUrl: process.env.API_URL ?? "http://localhost:4000",
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
    oauth: {
      googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      githubConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
    integrations: {
      googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      googlePlacesConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY),
      aladhanBase: process.env.ALADHAN_API_BASE ?? "https://api.aladhan.com/v1",
    },
  });
});

export default router;
