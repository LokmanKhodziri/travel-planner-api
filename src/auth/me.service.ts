import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { throwApiError } from "../common/errors";
import { isValidTimezone, validatePassword } from "../common/validation";
import { PasswordService } from "./password.service";

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

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  private serializeUser(user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    homeCity: string | null;
    timezone: string | null;
    role: "USER" | "ADMIN";
    createdAt: Date;
    passwordHash: string | null;
  }) {
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

  async buildProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) return null;

    const now = new Date();
    const [tripCount, activityCount, locationCount, upcomingTripCount] =
      await Promise.all([
        this.prisma.trip.count({ where: { userId } }),
        this.prisma.itineraryActivity.count({ where: { trip: { userId } } }),
        this.prisma.location.count({ where: { trip: { userId } } }),
        this.prisma.trip.count({
          where: { userId, endDate: { gte: now } },
        }),
      ]);

    return {
      ...this.serializeUser(user),
      stats: {
        trips: tripCount,
        activities: activityCount,
        locations: locationCount,
        upcomingTrips: upcomingTripCount,
      },
    };
  }

  async getProfile(userId: string) {
    const profile = await this.buildProfile(userId);
    if (!profile) throwApiError("User not found", 404);
    return profile;
  }

  async updateProfile(userId: string, body: Record<string, unknown>) {
    const data: {
      name?: string;
      homeCity?: string | null;
      timezone?: string | null;
      image?: string | null;
    } = {};

    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        throwApiError("Name is required", 400);
      }
      data.name = body.name.trim();
    }

    if (body?.homeCity !== undefined) {
      if (body.homeCity === null || body.homeCity === "") {
        data.homeCity = null;
      } else if (typeof body.homeCity === "string") {
        data.homeCity = body.homeCity.trim();
      } else {
        throwApiError("Invalid home city", 400);
      }
    }

    if (body?.timezone !== undefined) {
      if (body.timezone === null || body.timezone === "") {
        data.timezone = null;
      } else if (
        typeof body.timezone === "string" &&
        isValidTimezone(body.timezone.trim())
      ) {
        data.timezone = body.timezone.trim();
      } else {
        throwApiError("Invalid timezone", 400);
      }
    }

    if (body?.image !== undefined) {
      if (body.image === null || body.image === "") {
        data.image = null;
      } else if (
        typeof body.image === "string" &&
        /^https?:\/\//.test(body.image.trim())
      ) {
        data.image = body.image.trim();
      } else {
        throwApiError("Invalid profile image URL", 400);
      }
    }

    if (Object.keys(data).length === 0) {
      throwApiError("No profile fields to update", 400);
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, body: Record<string, unknown>) {
    const currentPassword = validatePassword(body?.currentPassword);
    const newPassword = validatePassword(body?.newPassword);

    if (!currentPassword || !newPassword) {
      throwApiError(
        "Current and new password are required (minimum 8 characters).",
        400,
      );
    }

    if (currentPassword === newPassword) {
      throwApiError(
        "New password must be different from the current password.",
        400,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throwApiError(
        "This account uses Google or GitHub sign-in and does not have a password.",
        400,
      );
    }

    const validCurrent = await this.passwords.verify(
      currentPassword,
      user.passwordHash,
    );
    if (!validCurrent) {
      throwApiError("Current password is incorrect.", 401);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });

    return { success: true };
  }
}
