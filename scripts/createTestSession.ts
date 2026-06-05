import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { signToken, getSessionExpiration } from "../src/middleware/auth.js";

async function main() {
  const email = process.env.TEST_USER_EMAIL ?? "dev+test@example.com";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: "Dev Tester" } });
  }

  const token = signToken(user.id);

  await prisma.session.create({
    data: {
      sessionToken: token,
      userId: user.id,
      expires: getSessionExpiration(),
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
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
