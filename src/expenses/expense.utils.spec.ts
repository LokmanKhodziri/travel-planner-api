import { ExpenseCategory } from "@prisma/client";
import { parseAmount, parseExpenseCategory } from "./expense.utils";

describe("parseAmount", () => {
  it("rounds to 2 decimal places", () => {
    expect(parseAmount(12.345)).toBe(12.35);
  });

  it("rejects zero, negative, and non-numeric values", () => {
    expect(parseAmount(0)).toBeNull();
    expect(parseAmount(-5)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("parseExpenseCategory", () => {
  it("accepts known categories", () => {
    expect(parseExpenseCategory("FOOD")).toBe(ExpenseCategory.FOOD);
  });

  it("falls back to OTHER", () => {
    expect(parseExpenseCategory("not-real")).toBe(ExpenseCategory.OTHER);
  });
});
