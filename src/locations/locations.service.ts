import { Injectable } from "@nestjs/common";
import { throwApiError } from "../common/errors";
import { GeocodeService } from "../integrations/geocode.service";
import { PrismaService } from "../prisma/prisma.service";

export interface TransformedLocation {
  name: string;
  latitude: number;
  longitude: number;
  county?: string;
  tripId: string;
  tripTitle: string;
  locationTitle: string;
  order: number;
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocode: GeocodeService,
  ) {}

  async listForUser(userId: string): Promise<TransformedLocation[]> {
    const locations = await this.prisma.location.findMany({
      where: { trip: { userId } },
      select: {
        locationTitle: true,
        latitude: true,
        longitude: true,
        order: true,
        tripId: true,
        trip: { select: { title: true } },
      },
      orderBy: [{ tripId: "asc" }, { order: "asc" }],
    });

    return Promise.all(
      locations.map(async (loc) => {
        const geo = await this.geocode.getCountyFromCoordinates(
          loc.latitude,
          loc.longitude,
        );
        return {
          name: `${loc.trip.title} - ${geo.formattedAddress}`,
          latitude: loc.latitude,
          longitude: loc.longitude,
          county: geo.county || undefined,
          tripId: loc.tripId,
          tripTitle: loc.trip.title,
          locationTitle: loc.locationTitle,
          order: loc.order,
        };
      }),
    );
  }

  async remove(id: string, tripId: string | undefined, userId: string) {
    if (!tripId) throwApiError("tripId query required", 400);

    const location = await this.prisma.location.findFirst({
      where: { id, tripId, trip: { userId } },
    });
    if (!location) throwApiError("Location not found", 404);

    await this.prisma.location.delete({ where: { id } });
    const remaining = await this.prisma.location.findMany({
      where: { tripId },
      orderBy: { order: "asc" },
    });
    await Promise.all(
      remaining.map((loc, index) =>
        this.prisma.location.update({
          where: { id: loc.id },
          data: { order: index },
        }),
      ),
    );
    return { success: true };
  }

  async reorder(
    userId: string,
    body: { tripId?: string; locationIds?: string[] },
  ) {
    const { tripId, locationIds } = body;
    if (!tripId || !Array.isArray(locationIds)) {
      throwApiError("tripId and locationIds required", 400);
    }

    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
    });
    if (!trip) throwApiError("Trip not found", 404);

    await Promise.all(
      locationIds.map((locationId, index) =>
        this.prisma.location.updateMany({
          where: { id: locationId, tripId },
          data: { order: index },
        }),
      ),
    );
    return { success: true };
  }
}
