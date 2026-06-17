import { Router } from "express";
import { ExpenseCategory, Prisma } from "@prisma/client";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

const EXPENSE_CATEGORIES = new Set<string>(Object.values(ExpenseCategory));

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function parseCategoryBudgets(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const budgets: Record<string, number> = {};
  for (const [key, rawAmount] of Object.entries(value)) {
    if (!EXPENSE_CATEGORIES.has(key)) continue;
    const amount = parseAmount(rawAmount);
    if (amount != null) budgets[key] = amount;
  }

  return Object.keys(budgets).length > 0 ? budgets : null;
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

    const budget = await prisma.tripBudget.findUnique({
      where: { tripId },
    });
    res.json(budget);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch budget" });
  }
});

router.put("/", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const trip = await getOwnedTrip(tripId, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const currency =
      typeof req.body.currency === "string" && req.body.currency.trim()
        ? req.body.currency.trim().toUpperCase()
        : "MYR";
    const totalAmount = parseAmount(req.body.totalAmount);
    const categoryBudgets = parseCategoryBudgets(req.body.categoryBudgets);

    if (totalAmount == null && !categoryBudgets) {
      res.status(400).json({
        error: "Set a total budget and/or at least one category budget",
      });
      return;
    }

    const budget = await prisma.tripBudget.upsert({
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
    res.json(budget);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save budget" });
  }
});

router.delete("/", async (req: AuthRequest, res) => {
  try {
    const tripId = req.params.tripId as string;
    const trip = await getOwnedTrip(tripId, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    await prisma.tripBudget.deleteMany({ where: { tripId } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to clear budget" });
  }
});

export default router;
