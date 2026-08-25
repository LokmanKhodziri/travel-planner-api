import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { throwApiError } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";
import { parseBudgetAmount, parseCategoryBudgets } from "./budget.utils";

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  private getOwnedTrip(tripId: string, userId: string) {
    return this.prisma.trip.findFirst({ where: { id: tripId, userId } });
  }

  async get(tripId: string, userId: string) {
    const trip = await this.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);
    return this.prisma.tripBudget.findUnique({ where: { tripId } });
  }

  async upsert(tripId: string, userId: string, body: Record<string, unknown>) {
    const trip = await this.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);

    const currency =
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : "MYR";
    const totalAmount = parseBudgetAmount(body.totalAmount);
    const categoryBudgets = parseCategoryBudgets(body.categoryBudgets);

    if (totalAmount == null && !categoryBudgets) {
      throwApiError(
        "Set a total budget and/or at least one category budget",
        400,
      );
    }

    return this.prisma.tripBudget.upsert({
      where: { tripId },
      create: {
        tripId,
        currency,
        totalAmount,
        categoryBudgets: categoryBudgets ?? Prisma.JsonNull,
      },
      update: {
        currency,
        totalAmount,
        categoryBudgets: categoryBudgets ?? Prisma.JsonNull,
      },
    });
  }

  async clear(tripId: string, userId: string) {
    const trip = await this.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);
    await this.prisma.tripBudget.deleteMany({ where: { tripId } });
    return { success: true };
  }
}
