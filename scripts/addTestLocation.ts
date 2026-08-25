import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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
  const trip = await prisma.trip.findFirst({
    where: { title: "Dev Test Trip" },
  });
  if (!trip) {
    throw new Error("Dev Test Trip not found; run createTestSession.ts first");
  }

  const location = await prisma.location.create({
    data: {
      locationTitle: "Test Location",
      latitude: 13.7563309,
      longitude: 100.5017651,
      tripId: trip.id,
    },
  });

  console.log(JSON.stringify({ tripId: trip.id, locationId: location.id }));
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
