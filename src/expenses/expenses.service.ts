import { Injectable } from "@nestjs/common";
import { throwApiError } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";
import { parseAmount, parseExpenseCategory } from "./expense.utils";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private getOwnedTrip(tripId: string, userId: string) {
    return this.prisma.trip.findFirst({ where: { id: tripId, userId } });
  }

  async list(tripId: string, userId: string) {
    const trip = await this.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);
    return this.prisma.tripExpense.findMany({
      where: { tripId },
      orderBy: [{ expenseDate: "desc" }, { createAt: "desc" }],
    });
  }

  async create(tripId: string, userId: string, body: Record<string, unknown>) {
    const { title, expenseDate, notes, currency, activityId } = body;
    const amount = parseAmount(body.amount);
    const category = parseExpenseCategory(body.category);

    if (!title || !expenseDate || amount == null) {
      throwApiError("title, amount and expenseDate are required", 400);
    }

    const parsedDate = new Date(String(expenseDate));
    if (Number.isNaN(parsedDate.getTime())) {
      throwApiError("Invalid expenseDate", 400);
    }

    const trip = await this.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);

    if (activityId) {
      const activity = await this.prisma.itineraryActivity.findFirst({
        where: { id: String(activityId), tripId },
      });
      if (!activity) {
        throwApiError("Linked activity not found on this trip", 400);
      }
    }

    return this.prisma.tripExpense.create({
      data: {
        title: String(title).trim(),
        amount,
        currency:
          typeof currency === "string" && currency.trim()
            ? currency.trim().toUpperCase()
            : "MYR",
        category,
        expenseDate: parsedDate,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        tripId,
        activityId: activityId ? String(activityId) : null,
      },
    });
  }

  async update(
    tripId: string,
    expenseId: string,
    userId: string,
    body: Record<string, unknown>,
  ) {
    const existing = await this.prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId, trip: { userId } },
    });
    if (!existing) throwApiError("Expense not found", 404);

    const amount =
      body.amount === undefined ? existing.amount : parseAmount(body.amount);
    if (amount == null) throwApiError("Invalid amount", 400);

    const expenseDate = body.expenseDate
      ? new Date(String(body.expenseDate))
      : existing.expenseDate;
    if (Number.isNaN(expenseDate.getTime())) {
      throwApiError("Invalid expenseDate", 400);
    }

    if (body.activityId) {
      const activity = await this.prisma.itineraryActivity.findFirst({
        where: { id: String(body.activityId), tripId },
      });
      if (!activity) {
        throwApiError("Linked activity not found on this trip", 400);
      }
    }

    return this.prisma.tripExpense.update({
      where: { id: expenseId },
      data: {
        title:
          typeof body.title === "string"
            ? body.title.trim() || existing.title
            : existing.title,
        amount,
        currency:
          typeof body.currency === "string" && body.currency.trim()
            ? body.currency.trim().toUpperCase()
            : existing.currency,
        category:
          body.category !== undefined
            ? parseExpenseCategory(body.category)
            : existing.category,
        expenseDate,
        notes:
          body.notes === undefined
            ? existing.notes
            : typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null,
        activityId:
          body.activityId === undefined
            ? existing.activityId
            : body.activityId
              ? String(body.activityId)
              : null,
      },
    });
  }

  async remove(tripId: string, expenseId: string, userId: string) {
    const existing = await this.prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId, trip: { userId } },
    });
    if (!existing) throwApiError("Expense not found", 404);
    await this.prisma.tripExpense.delete({ where: { id: expenseId } });
    return { success: true };
  }
}
