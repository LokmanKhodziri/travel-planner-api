import { Injectable } from "@nestjs/common";
import { SESSION_TIMEOUT_MINUTES } from "../auth/token.service";
import { PlacesService, type NearbyPlace } from "../integrations/places.service";
import { PrismaService } from "../prisma/prisma.service";

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

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesService,
  ) {}

  private getRecentSourceLocations(): Promise<SourceLocation[]> {
    return this.prisma.location.findMany({
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

  private async buildNearbyAdminRows(
    finder: (
      latitude: number,
      longitude: number,
      radius?: number,
    ) => Promise<NearbyPlace[]>,
  ) {
    const sourceLocations = await this.getRecentSourceLocations();
    return Promise.all(
      sourceLocations.map(async (location) => {
        try {
          const places = await finder(
            location.latitude,
            location.longitude,
            5000,
          );
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

  async summary() {
    const [users, trips, locations, activities, activeSessions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.trip.count(),
        this.prisma.location.count(),
        this.prisma.itineraryActivity.count(),
        this.prisma.session.count({ where: { expires: { gt: new Date() } } }),
      ]);
    return { users, trips, locations, activities, activeSessions };
  }

  users() {
    return this.prisma.user.findMany({
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
  }

  trips() {
    return this.prisma.trip.findMany({
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
  }

  locations() {
    return this.prisma.location.findMany({
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
  }

  async prayerFacilities() {
    const rows = await this.buildNearbyAdminRows((lat, lng, radius) =>
      this.places.findNearbyMosques(lat, lng, radius),
    );
    return {
      source: "Google Places live search",
      note: "Prayer facilities are discovered around the 5 most recent saved trip locations and are not stored in the database.",
      rows,
    };
  }

  async halalRestaurants() {
    const rows = await this.buildNearbyAdminRows((lat, lng, radius) =>
      this.places.findNearbyHalal(lat, lng, radius),
    );
    return {
      source: "Google Places live search",
      note: "Halal restaurants are discovered around the 5 most recent saved trip locations and are not stored in the database.",
      rows,
    };
  }

  settings() {
    return {
      sessionTimeoutMinutes: SESSION_TIMEOUT_MINUTES,
      adminEmails: (process.env.ADMIN_EMAILS ?? "admin123@travel.com")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean),
      apiUrl: process.env.API_URL ?? "http://localhost:4000",
      frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
      oauth: {
        googleConfigured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        ),
        githubConfigured: Boolean(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
        ),
      },
      integrations: {
        googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
        googlePlacesConfigured: Boolean(
          process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY,
        ),
        aladhanBase:
          process.env.ALADHAN_API_BASE ?? "https://api.aladhan.com/v1",
      },
    };
  }
}
