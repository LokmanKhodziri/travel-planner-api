import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../services/password.js";

const router = Router();

const userSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  homeCity: true,
  timezone: true,
  role: true,
  createdAt: true,
  passwordHash: true,
} as const;

function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return null;
  return password.length >= 8 ? password : null;
}

function serializeUser(
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    homeCity: string | null;
    timezone: string | null;
    role: "USER" | "ADMIN";
    createdAt: Date;
    passwordHash: string | null;
  },
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    homeCity: user.homeCity,
    timezone: user.timezone,
    role: user.role,
    createAt: user.createdAt.toISOString(),
    hasPassword: Boolean(user.passwordHash),
  };
}

async function buildProfileResponse(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) return null;

  const now = new Date();
  const [tripCount, activityCount, locationCount, upcomingTripCount] =
    await Promise.all([
      prisma.trip.count({ where: { userId } }),
      prisma.itineraryActivity.count({ where: { trip: { userId } } }),
      prisma.location.count({ where: { trip: { userId } } }),
      prisma.trip.count({
        where: { userId, endDate: { gte: now } },
      }),
    ]);

  return {
    ...serializeUser(user),
    stats: {
      trips: tripCount,
      activities: activityCount,
      locations: locationCount,
      upcomingTrips: upcomingTripCount,
    },
  };
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const profile = await buildProfileResponse(req.user!.id);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(profile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.patch("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const data: {
      name?: string;
      homeCity?: string | null;
      timezone?: string | null;
      image?: string | null;
    } = {};

    if (req.body?.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      data.name = req.body.name.trim();
    }

    if (req.body?.homeCity !== undefined) {
      if (req.body.homeCity === null || req.body.homeCity === "") {
        data.homeCity = null;
      } else if (typeof req.body.homeCity === "string") {
        data.homeCity = req.body.homeCity.trim();
      } else {
        res.status(400).json({ error: "Invalid home city" });
        return;
      }
    }

    if (req.body?.timezone !== undefined) {
      if (req.body.timezone === null || req.body.timezone === "") {
        data.timezone = null;
      } else if (
        typeof req.body.timezone === "string" &&
        isValidTimezone(req.body.timezone.trim())
      ) {
        data.timezone = req.body.timezone.trim();
      } else {
        res.status(400).json({ error: "Invalid timezone" });
        return;
      }
    }

    if (req.body?.image !== undefined) {
      if (req.body.image === null || req.body.image === "") {
        data.image = null;
      } else if (
        typeof req.body.image === "string" &&
        /^https?:\/\//.test(req.body.image.trim())
      ) {
        data.image = req.body.image.trim();
      } else {
        res.status(400).json({ error: "Invalid profile image URL" });
        return;
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No profile fields to update" });
      return;
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    const profile = await buildProfileResponse(req.user!.id);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(profile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.post("/password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentPassword = validatePassword(req.body?.currentPassword);
    const newPassword = validatePassword(req.body?.newPassword);

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: "Current and new password are required (minimum 8 characters).",
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        error: "New password must be different from the current password.",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      res.status(400).json({
        error:
          "This account uses Google or GitHub sign-in and does not have a password.",
      });
      return;
    }

    const validCurrent = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!validCurrent) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
