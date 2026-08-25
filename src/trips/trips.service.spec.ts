import { HttpException } from "@nestjs/common";
import { TripsService } from "./trips.service";
import { createPrismaMock } from "../testing/prisma.mock";

describe("TripsService", () => {
  const prisma = createPrismaMock();
  const tripUtils = {
    syncTripLocationsFromActivities: jest.fn(),
    ensureTripLocation: jest.fn(),
  };
  const geocode = { geocodeAddress: jest.fn() };
  const service = new TripsService(
    prisma as never,
    tripUtils as never,
    geocode as never,
  );

  const user = {
    id: "user-1",
    email: "user@test.com",
    name: "Lokman",
    image: null,
    role: "USER" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists trips for the current user", async () => {
    prisma.trip.findMany.mockResolvedValue([{ id: "t1", title: "KL" }]);
    await expect(service.list("user-1")).resolves.toEqual([
      { id: "t1", title: "KL" },
    ]);
    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { startDate: "desc" },
    });
  });

  it("rejects incomplete create payloads", async () => {
    await expect(
      service.create("user-1", { title: "KL" }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("creates a trip", async () => {
    prisma.trip.create.mockResolvedValue({ id: "t1", title: "KL" });
    const trip = await service.create("user-1", {
      title: "KL",
      description: "Weekend",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
    });
    expect(trip.id).toBe("t1");
  });

  it("returns 404 when deleting a missing trip", async () => {
    prisma.trip.findFirst.mockResolvedValue(null);
    await expect(service.remove("missing", user)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it("deletes locations then the trip", async () => {
    prisma.trip.findFirst.mockResolvedValue({ id: "t1", userId: "user-1" });
    prisma.$transaction.mockResolvedValue([]);
    await expect(service.remove("t1", user)).resolves.toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
