import "dotenv/config";
import { randomUUID } from "node:crypto";
import * as jwt from "jsonwebtoken";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.service";

const DEFAULT_PASSWORD = "Musafir123!";
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";

const jwtSign =
  (jwt as { default?: { sign: typeof jwt.sign }; sign?: typeof jwt.sign }).default?.sign ??
  jwt.sign;

function signSessionToken(userId: string): string {
  return jwtSign({ sub: userId, jti: randomUUID() }, JWT_SECRET, { expiresIn: "7d" });
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function randomDateBetween(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return new Date(startMs + Math.random() * (endMs - startMs));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

type SeedUser = {
  name: string;
  email: string;
  homeCity: string;
};

const MALAYSIAN_USERS: SeedUser[] = [
  { name: "Ahmad bin Hassan", email: "ahmad.hassan@musafir-demo.my", homeCity: "Kuala Lumpur" },
  { name: "Siti Nur Aina", email: "siti.aina@musafir-demo.my", homeCity: "Penang" },
  { name: "Lim Wei Jian", email: "wei.jian.lim@musafir-demo.my", homeCity: "Johor Bahru" },
  { name: "Priya Devi Raj", email: "priya.devi@musafir-demo.my", homeCity: "Ipoh" },
  { name: "Muhammad Faris", email: "faris.mohd@musafir-demo.my", homeCity: "Kota Kinabalu" },
  { name: "Nurul Huda", email: "nurul.huda@musafir-demo.my", homeCity: "Kuching" },
  { name: "Tan Mei Ling", email: "mei.ling.tan@musafir-demo.my", homeCity: "Melaka" },
  { name: "Arif Rahman", email: "arif.rahman@musafir-demo.my", homeCity: "Shah Alam" },
];

type TripTemplate = {
  title: string;
  description: string;
  destinationCity: string;
  destinationLat: number;
  destinationLng: number;
  daysAfterSignup: number;
  durationDays: number;
  locations: { title: string; lat: number; lng: number }[];
};

const TRIP_TEMPLATES: TripTemplate[] = [
  {
    title: "Penang Food & Heritage Tour",
    description: "Explore Georgetown UNESCO sites, Char Kuey Teow, and mosque visits.",
    destinationCity: "George Town, Penang",
    destinationLat: 5.4141,
    destinationLng: 100.3288,
    daysAfterSignup: 5,
    durationDays: 3,
    locations: [
      { title: "Kapitan Keling Mosque", lat: 5.4189, lng: 100.3392 },
      { title: "Penang Hill", lat: 5.4253, lng: 100.2692 },
      { title: "Gurney Drive", lat: 5.4365, lng: 100.3097 },
    ],
  },
  {
    title: "Langkawi Island Escape",
    description: "Beach relaxation, cable car, and duty-free shopping.",
    destinationCity: "Langkawi, Kedah",
    destinationLat: 6.3500,
    destinationLng: 99.8000,
    daysAfterSignup: 12,
    durationDays: 4,
    locations: [
      { title: "Pantai Cenang", lat: 6.2881, lng: 99.7285 },
      { title: "Langkawi Sky Bridge", lat: 6.3871, lng: 99.6624 },
    ],
  },
  {
    title: "KL City & Culture Break",
    description: "Petronas Towers, Batu Caves, and halal dining in the capital.",
    destinationCity: "Kuala Lumpur",
    destinationLat: 3.1390,
    destinationLng: 101.6869,
    daysAfterSignup: 3,
    durationDays: 2,
    locations: [
      { title: "Petronas Twin Towers", lat: 3.1578, lng: 101.7116 },
      { title: "Batu Caves", lat: 3.2379, lng: 101.6840 },
      { title: "Masjid Negara", lat: 3.1419, lng: 101.6916 },
    ],
  },
  {
    title: "Melaka Historical Walk",
    description: "Jonker Street, A Famosa, and riverside evening stroll.",
    destinationCity: "Melaka",
    destinationLat: 2.1896,
    destinationLng: 102.2501,
    daysAfterSignup: 8,
    durationDays: 2,
    locations: [
      { title: "Jonker Walk", lat: 2.1945, lng: 102.2487 },
      { title: "Masjid Kampung Hulu", lat: 2.1997, lng: 102.2478 },
    ],
  },
  {
    title: "Cameron Highlands Retreat",
    description: "Cool climate, tea plantations, and strawberry farms.",
    destinationCity: "Cameron Highlands, Pahang",
    destinationLat: 4.4721,
    destinationLng: 101.3800,
    daysAfterSignup: 20,
    durationDays: 3,
    locations: [
      { title: "BOH Tea Plantation", lat: 4.4406, lng: 101.4232 },
      { title: "Brinchang Night Market", lat: 4.4934, lng: 101.3854 },
    ],
  },
];

async function main() {
  const prisma = createPrisma();

  const accountStart = new Date("2026-06-09T00:00:00+08:00");
  const accountEnd = new Date("2026-06-11T23:59:59+08:00");
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  console.log("Seeding Malaysian users, trips, and sessions...");
  console.log(`Account createdAt range: ${accountStart.toISOString()} → ${accountEnd.toISOString()}\n`);

  const summary: Array<{
    name: string;
    email: string;
    createdAt: string;
    trips: number;
    sessions: number;
  }> = [];

  for (let i = 0; i < MALAYSIAN_USERS.length; i++) {
    const profile = MALAYSIAN_USERS[i];
    const createdAt = randomDateBetween(accountStart, accountEnd);

    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name,
        homeCity: profile.homeCity,
        timezone: "Asia/Kuala_Lumpur",
        passwordHash,
        role: "USER",
        createdAt,
        updatedAt: createdAt,
      },
      create: {
        email: profile.email,
        name: profile.name,
        homeCity: profile.homeCity,
        timezone: "Asia/Kuala_Lumpur",
        passwordHash,
        role: "USER",
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.trip.deleteMany({ where: { userId: user.id } });

    // 1–2 trips per user (rotate templates)
    const tripCount = i % 3 === 0 ? 2 : 1;
    const tripOffsets = [i % TRIP_TEMPLATES.length, (i + 2) % TRIP_TEMPLATES.length];

    for (let t = 0; t < tripCount; t++) {
      const template = TRIP_TEMPLATES[tripOffsets[t]];
      const tripStart = addDays(new Date(createdAt), template.daysAfterSignup + t * 2);
      const tripEnd = addDays(new Date(tripStart), template.durationDays);

      const trip = await prisma.trip.create({
        data: {
          title: template.title,
          description: template.description,
          destinationCity: template.destinationCity,
          destinationLat: template.destinationLat,
          destinationLng: template.destinationLng,
          startDate: tripStart,
          endDate: tripEnd,
          userId: user.id,
          createAt: addDays(createdAt, 1),
          locations: {
            create: template.locations.map((loc, order) => ({
              locationTitle: loc.title,
              latitude: loc.lat,
              longitude: loc.lng,
              order,
              createAt: addDays(createdAt, 1),
            })),
          },
          budget: {
            create: {
              currency: "MYR",
              totalAmount: 1500 + Math.floor(Math.random() * 2500),
              createAt: addDays(createdAt, 1),
            },
          },
        },
      });

      const activityStart = new Date(tripStart);
      activityStart.setHours(9, 0, 0, 0);
      const activityEnd = new Date(tripStart);
      activityEnd.setHours(12, 0, 0, 0);

      await prisma.itineraryActivity.create({
        data: {
          title: `Explore ${template.locations[0].title}`,
          description: "Planned visit with prayer break nearby.",
          address: template.destinationCity,
          latitude: template.locations[0].lat,
          longitude: template.locations[0].lng,
          startTime: activityStart,
          endTime: activityEnd,
          order: 0,
          tripId: trip.id,
          createAt: addDays(createdAt, 1),
        },
      });
    }

    // Sessions: one historical login + optional active session for first 3 users
    const sessionCount = i < 3 ? 2 : 1;

    for (let s = 0; s < sessionCount; s++) {
      const sessionCreatedAt = randomDateBetween(
        createdAt,
        addDays(createdAt, s === 0 ? 1 : 2),
      );
      const token = signSessionToken(user.id);
      const isActive = s === 1 && i < 3;

      await prisma.session.create({
        data: {
          sessionToken: token,
          userId: user.id,
          expires: isActive
            ? addDays(new Date(), 7)
            : addMinutes(sessionCreatedAt, 10),
          createdAt: sessionCreatedAt,
          updatedAt: sessionCreatedAt,
        },
      });
    }

    const trips = await prisma.trip.count({ where: { userId: user.id } });
    const sessions = await prisma.session.count({ where: { userId: user.id } });

    summary.push({
      name: profile.name,
      email: profile.email,
      createdAt: createdAt.toISOString(),
      trips,
      sessions,
    });
  }

  console.log("Done!\n");
  console.log("Default password for all seeded users:", DEFAULT_PASSWORD);
  console.log("\n| Name | Email | Account created | Trips | Sessions |");
  console.log("|------|-------|-----------------|-------|----------|");
  for (const row of summary) {
    console.log(
      `| ${row.name} | ${row.email} | ${row.createdAt.slice(0, 10)} | ${row.trips} | ${row.sessions} |`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
