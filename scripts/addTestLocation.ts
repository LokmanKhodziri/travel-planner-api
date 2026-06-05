import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
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
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
