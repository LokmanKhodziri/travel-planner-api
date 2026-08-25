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
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

type SeedUser = { name: string; email: string; homeCity: string };

/** 16 additional Malaysian users (batch 2 — does not modify existing accounts). */
const MALAYSIAN_USERS_BATCH_2: SeedUser[] = [
  { name: "Zulkifli bin Omar", email: "zulkifli.omar@musafir-demo.my", homeCity: "Seremban" },
  { name: "Aisyah Kamal", email: "aisyah.kamal@musafir-demo.my", homeCity: "Kuala Terengganu" },
  { name: "Ong Jia Hui", email: "jia.hui.ong@musafir-demo.my", homeCity: "Petaling Jaya" },
  { name: "Rajesh Kumar", email: "rajesh.kumar@musafir-demo.my", homeCity: "Butterworth" },
  { name: "Fatimah Zahra", email: "fatimah.zahra@musafir-demo.my", homeCity: "Alor Setar" },
  { name: "Hafizuddin Yusof", email: "hafiz.yusof@musafir-demo.my", homeCity: "Kuantan" },
  { name: "Chong Li Yen", email: "li.yen.chong@musafir-demo.my", homeCity: "Sandakan" },
  { name: "Nadia Izzati", email: "nadia.izzati@musafir-demo.my", homeCity: "Putrajaya" },
  { name: "Syafiq Azman", email: "syafiq.azman@musafir-demo.my", homeCity: "Miri" },
  { name: "Deepa Menon", email: "deepa.menon@musafir-demo.my", homeCity: "Taiping" },
  { name: "Irfan Hakimi", email: "irfan.hakimi@musafir-demo.my", homeCity: "Kangar" },
  { name: "Wong Siew Mei", email: "siew.mei.wong@musafir-demo.my", homeCity: "Kota Bharu" },
  { name: "Amirul Hadi", email: "amirul.hadi@musafir-demo.my", homeCity: "Batu Pahat" },
  { name: "Shalini Nair", email: "shalini.nair@musafir-demo.my", homeCity: "Subang Jaya" },
  { name: "Daniel Anak Joseph", email: "daniel.joseph@musafir-demo.my", homeCity: "Sibu" },
  { name: "Nur Afiqah", email: "afiqah.nur@musafir-demo.my", homeCity: "Cyberjaya" },
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
    title: "Redang Island Diving Trip",
    description: "Snorkelling, beach stays, and seafood by the east coast.",
    destinationCity: "Redang Island, Terengganu",
    destinationLat: 5.7844,
    destinationLng: 103.0139,
    daysAfterSignup: 7,
    durationDays: 3,
    locations: [
      { title: "Pasir Panjang Beach", lat: 5.7692, lng: 103.0078 },
      { title: "Redang Marine Park", lat: 5.8011, lng: 103.0234 },
    ],
  },
  {
    title: "Johor Bahru Weekend",
    description: "City malls, halal food, and short hop to Singapore views.",
    destinationCity: "Johor Bahru",
    destinationLat: 1.4927,
    destinationLng: 103.7414,
    daysAfterSignup: 4,
    durationDays: 2,
    locations: [
      { title: "Sultan Abu Bakar Mosque", lat: 1.4675, lng: 103.7382 },
      { title: "Danga Bay", lat: 1.4578, lng: 103.7265 },
    ],
  },
  {
    title: "Perhentian Islands Getaway",
    description: "Crystal-clear waters and relaxed island pace.",
    destinationCity: "Perhentian Islands",
    destinationLat: 5.9020,
    destinationLng: 102.7630,
    daysAfterSignup: 14,
    durationDays: 4,
    locations: [
      { title: "Perhentian Kecil", lat: 5.9012, lng: 102.7289 },
      { title: "Teluk KK", lat: 5.9145, lng: 102.7412 },
    ],
  },
  {
    title: "Ipoh Heritage & Food Trail",
    description: "Old town murals, limestone hills, and bean sprout chicken.",
    destinationCity: "Ipoh, Perak",
    destinationLat: 4.5975,
    destinationLng: 101.0901,
    daysAfterSignup: 6,
    durationDays: 2,
    locations: [
      { title: "Concubine Lane", lat: 4.5978, lng: 101.0778 },
      { title: "Masjid Panglima Kinta", lat: 4.5923, lng: 101.0812 },
    ],
  },
  {
    title: "Kota Kinabalu Nature Tour",
    description: "Mount Kinabalu views, waterfront, and Sabah culture.",
    destinationCity: "Kota Kinabalu, Sabah",
    destinationLat: 5.9804,
    destinationLng: 116.0735,
    daysAfterSignup: 10,
    durationDays: 3,
    locations: [
      { title: "Masjid Bandaraya KK", lat: 5.9912, lng: 116.0778 },
      { title: "Tanjung Aru Beach", lat: 5.9567, lng: 116.0512 },
    ],
  },
  {
    title: "Kuching Riverside Discovery",
    description: "Sarawak riverfront, cat statues, and local markets.",
    destinationCity: "Kuching, Sarawak",
    destinationLat: 1.5535,
    destinationLng: 110.3593,
    daysAfterSignup: 9,
    durationDays: 3,
    locations: [
      { title: "Kuching Waterfront", lat: 1.5598, lng: 110.3489 },
      { title: "Masjid Jamek Kuching", lat: 1.5589, lng: 110.3456 },
    ],
  },
];

async function seedUser(
  prisma: PrismaClient,
  profile: SeedUser,
  index: number,
  accountStart: Date,
  accountEnd: Date,
  passwordHash: string,
) {
  const createdAt = randomDateBetween(accountStart, accountEnd);

  const existing = await prisma.user.findUnique({ where: { email: profile.email } });

  const user = existing
    ? await prisma.user.update({
        where: { email: profile.email },
        data: {
          name: profile.name,
          homeCity: profile.homeCity,
          timezone: "Asia/Kuala_Lumpur",
          passwordHash,
          role: "USER",
          createdAt,
          updatedAt: createdAt,
        },
      })
    : await prisma.user.create({
        data: {
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

  const tripCount = index % 4 === 0 ? 2 : 1;
  const tripOffsets = [index % TRIP_TEMPLATES.length, (index + 3) % TRIP_TEMPLATES.length];

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
            totalAmount: 1200 + Math.floor(Math.random() * 3000),
            createAt: addDays(createdAt, 1),
          },
        },
      },
    });

    const activityStart = new Date(tripStart);
    activityStart.setHours(10, 0, 0, 0);
    const activityEnd = new Date(tripStart);
    activityEnd.setHours(13, 0, 0, 0);

    await prisma.itineraryActivity.create({
      data: {
        title: `Visit ${template.locations[0].title}`,
        description: "Half-day itinerary with nearby prayer facilities.",
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

  const sessionCount = index % 5 === 0 ? 2 : 1;
  for (let s = 0; s < sessionCount; s++) {
    const sessionCreatedAt = randomDateBetween(
      createdAt,
      addDays(createdAt, s === 0 ? 1 : 2),
    );
    const isActive = s === 1 && index % 5 === 0;

    await prisma.session.create({
      data: {
        sessionToken: signSessionToken(user.id),
        userId: user.id,
        expires: isActive ? addDays(new Date(), 7) : addMinutes(sessionCreatedAt, 10),
        createdAt: sessionCreatedAt,
        updatedAt: sessionCreatedAt,
      },
    });
  }

  const trips = await prisma.trip.count({ where: { userId: user.id } });
  const sessions = await prisma.session.count({ where: { userId: user.id } });

  return {
    name: profile.name,
    email: profile.email,
    createdAt: createdAt.toISOString(),
    trips,
    sessions,
    isNew: !existing,
  };
}

async function main() {
  const prisma = createPrisma();
  const accountStart = new Date("2026-06-09T00:00:00+08:00");
  const accountEnd = new Date("2026-06-11T23:59:59+08:00");
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const beforeCount = await prisma.user.count();

  console.log(`Adding ${MALAYSIAN_USERS_BATCH_2.length} Malaysian users (batch 2)...`);
  console.log(`Users in database before: ${beforeCount}\n`);

  const summary = [];
  for (let i = 0; i < MALAYSIAN_USERS_BATCH_2.length; i++) {
    summary.push(
      await seedUser(
        prisma,
        MALAYSIAN_USERS_BATCH_2[i],
        i,
        accountStart,
        accountEnd,
        passwordHash,
      ),
    );
  }

  const afterCount = await prisma.user.count();
  const newUsers = summary.filter((r) => r.isNew).length;

  console.log("Done!\n");
  console.log(`Users in database after: ${afterCount} (+${afterCount - beforeCount} net)`);
  console.log(`New accounts created: ${newUsers}`);
  console.log(`Default password: ${DEFAULT_PASSWORD}\n`);
  console.log("| Name | Email | Created | Trips | Sessions |");
  console.log("|------|-------|---------|-------|----------|");
  for (const row of summary) {
    console.log(
      `| ${row.name} | ${row.email} | ${row.createdAt.slice(0, 10)} | ${row.trips} | ${row.sessions} |`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
