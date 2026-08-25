export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return null;
  return password.length >= 8 ? password : null;
}

export function parseAdminEmails(value = process.env.ADMIN_EMAILS) {
  return new Set(
    (value ?? "admin123@travel.com")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function roleForEmail(
  email: string,
  adminEmails = parseAdminEmails(),
): "USER" | "ADMIN" {
  return adminEmails.has(email) ? "ADMIN" : "USER";
}

export function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
