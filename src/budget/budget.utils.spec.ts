import { parseBudgetAmount, parseCategoryBudgets } from "./budget.utils";

describe("parseBudgetAmount", () => {
  it("treats empty values as null", () => {
    expect(parseBudgetAmount(null)).toBeNull();
    expect(parseBudgetAmount("")).toBeNull();
  });

  it("parses a positive amount", () => {
    expect(parseBudgetAmount("100.5")).toBe(100.5);
  });
});

describe("parseCategoryBudgets", () => {
  it("keeps only valid expense categories", () => {
    expect(
      parseCategoryBudgets({
        FOOD: 50,
        UNKNOWN: 10,
        TRANSPORT: 20,
      }),
    ).toEqual({ FOOD: 50, TRANSPORT: 20 });
  });

  it("returns null for empty or invalid input", () => {
    expect(parseCategoryBudgets(null)).toBeNull();
    expect(parseCategoryBudgets({ UNKNOWN: 10 })).toBeNull();
  });
});
