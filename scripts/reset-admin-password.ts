/**
 * Reset password for an email account.
 *
 * Usage:
 *   npx tsx scripts/reset-admin-password.ts
 *   npx tsx scripts/reset-admin-password.ts admin123@travel.com MyNewPass123!
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.service";

const email = process.argv[2] ?? "admin123@travel.com";
const newPassword = process.argv[3] ?? "Admin123!";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    console.error("Sign up at /login first, or use a different email.");
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  console.log(`Password reset successfully.`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${newPassword}`);
  console.log(`  Role:     ${user.role}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
