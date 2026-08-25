import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { TokenService } from "../src/auth/token.service";

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function main() {
  const prisma = createPrisma();
  const tokens = new TokenService();
  const email = process.env.TEST_USER_EMAIL ?? "dev+test@example.com";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: "Dev Tester" } });
  }

  const token = tokens.sign(user.id);

  await prisma.session.create({
    data: {
      sessionToken: token,
      userId: user.id,
      expires: tokens.getSessionExpiration(),
    },
  });

  const trip = await prisma.trip.create({
    data: {
      title: "Dev Test Trip",
      description: "Auto-created trip for headless test",
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      userId: user.id,
    },
  });

  console.log(JSON.stringify({ token, tripId: trip.id }));
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
