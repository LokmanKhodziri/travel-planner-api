import { ExpenseCategory } from "@prisma/client";

const EXPENSE_CATEGORIES = new Set<string>(Object.values(ExpenseCategory));

export function parseBudgetAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function parseCategoryBudgets(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const budgets: Record<string, number> = {};
  for (const [key, rawAmount] of Object.entries(value)) {
    if (!EXPENSE_CATEGORIES.has(key)) continue;
    const amount = parseBudgetAmount(rawAmount);
    if (amount != null) budgets[key] = amount;
  }

  return Object.keys(budgets).length > 0 ? budgets : null;
}
