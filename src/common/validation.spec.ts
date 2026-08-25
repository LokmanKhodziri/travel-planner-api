import {
  normalizeEmail,
  roleForEmail,
  validatePassword,
} from "./validation";

describe("normalizeEmail", () => {
  it("lowercases and trims valid emails", () => {
    expect(normalizeEmail("  Admin@Travel.COM ")).toBe("admin@travel.com");
  });

  it("rejects invalid emails", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(123)).toBeNull();
  });
});

describe("validatePassword", () => {
  it("requires at least 8 characters", () => {
    expect(validatePassword("short")).toBeNull();
    expect(validatePassword("longenough")).toBe("longenough");
  });
});

describe("roleForEmail", () => {
  it("assigns ADMIN when the email is in the allow-list", () => {
    expect(roleForEmail("admin@test.com", new Set(["admin@test.com"]))).toBe(
      "ADMIN",
    );
  });

  it("assigns USER otherwise", () => {
    expect(roleForEmail("user@test.com", new Set(["admin@test.com"]))).toBe(
      "USER",
    );
  });
});
