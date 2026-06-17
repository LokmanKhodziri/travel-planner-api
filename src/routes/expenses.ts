import { Router } from "express";
import { ExpenseCategory } from "@prisma/client";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

const EXPENSE_CATEGORIES = new Set<string>(Object.values(ExpenseCategory));

function parseExpenseCategory(value: unknown) {
  if (typeof value === "string" && EXPENSE_CATEGORIES.has(value)) {
    return value as ExpenseCategory;
  }
  return ExpenseCategory.OTHER;
}

function parseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

async function getOwnedTrip(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
}

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const trip = await getOwnedTrip(tripId, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const expenses = await prisma.tripExpense.findMany({
      where: { tripId },
      orderBy: [{ expenseDate: "desc" }, { createAt: "desc" }],
    });
    res.json(expenses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const { title, expenseDate, notes, currency, activityId } = req.body;
    const amount = parseAmount(req.body.amount);
    const category = parseExpenseCategory(req.body.category);

    if (!title || !expenseDate || amount == null) {
      res.status(400).json({ error: "title, amount and expenseDate are required" });
      return;
    }

    const parsedDate = new Date(expenseDate);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400).json({ error: "Invalid expenseDate" });
      return;
    }

    const trip = await getOwnedTrip(tripId, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    if (activityId) {
      const activity = await prisma.itineraryActivity.findFirst({
        where: { id: activityId, tripId },
      });
      if (!activity) {
        res.status(400).json({ error: "Linked activity not found on this trip" });
        return;
      }
    }

    const expense = await prisma.tripExpense.create({
      data: {
        title: String(title).trim(),
        amount,
        currency:
          typeof currency === "string" && currency.trim()
            ? currency.trim().toUpperCase()
            : "MYR",
        category,
        expenseDate: parsedDate,
        notes:
          typeof notes === "string" && notes.trim() ? notes.trim() : null,
        tripId,
        activityId: activityId || null,
      },
    });
    res.status(201).json(expense);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

router.delete("/:expenseId", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const expenseId = req.params.expenseId as string;
    const existing = await prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId, trip: { userId: req.user!.id } },
    });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    await prisma.tripExpense.delete({ where: { id: expenseId } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export default router;
