import { ExpenseCategory } from "@prisma/client";

const EXPENSE_CATEGORIES = new Set<string>(Object.values(ExpenseCategory));

export function parseExpenseCategory(value: unknown): ExpenseCategory {
  if (typeof value === "string" && EXPENSE_CATEGORIES.has(value)) {
    return value as ExpenseCategory;
  }
  return ExpenseCategory.OTHER;
}

export function parseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}
