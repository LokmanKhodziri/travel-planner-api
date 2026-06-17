import { Router } from "express";
import { ExpenseCategory } from "@prisma/client";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

const EXPENSE_CATEGORIES = new Set<string>(Object.values(ExpenseCategory));

function parseExpenseCategory(value: unknown): ExpenseCategory {
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

// GET /api/trips/:tripId/expenses
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

// POST /api/trips/:tripId/expenses
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
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
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

// PATCH /api/trips/:tripId/expenses/:expenseId
router.patch("/:expenseId", async (req: AuthRequest, res) => {
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

    const amount =
      req.body.amount === undefined ? existing.amount : parseAmount(req.body.amount);
    if (amount == null) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    const expenseDate = req.body.expenseDate
      ? new Date(req.body.expenseDate)
      : existing.expenseDate;
    if (Number.isNaN(expenseDate.getTime())) {
      res.status(400).json({ error: "Invalid expenseDate" });
      return;
    }

    if (req.body.activityId) {
      const activity = await prisma.itineraryActivity.findFirst({
        where: { id: req.body.activityId, tripId },
      });
      if (!activity) {
        res.status(400).json({ error: "Linked activity not found on this trip" });
        return;
      }
    }

    const expense = await prisma.tripExpense.update({
      where: { id: expenseId },
      data: {
        title:
          typeof req.body.title === "string"
            ? req.body.title.trim() || existing.title
            : existing.title,
        amount,
        currency:
          typeof req.body.currency === "string" && req.body.currency.trim()
            ? req.body.currency.trim().toUpperCase()
            : existing.currency,
        category:
          req.body.category !== undefined
            ? parseExpenseCategory(req.body.category)
            : existing.category,
        expenseDate,
        notes:
          req.body.notes === undefined
            ? existing.notes
            : typeof req.body.notes === "string" && req.body.notes.trim()
              ? req.body.notes.trim()
              : null,
        activityId:
          req.body.activityId === undefined
            ? existing.activityId
            : req.body.activityId || null,
      },
    });

    res.json(expense);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// DELETE /api/trips/:tripId/expenses/:expenseId
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
