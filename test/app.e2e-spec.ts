import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  resetTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./test-database";

describe("API e2e (real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-secret";
    process.env.ADMIN_EMAILS = "admin@test.com";
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.API_URL = "http://localhost:4000";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    await startTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect().catch(() => undefined);
    await app?.close();
    await stopTestDatabase();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDatabase(prisma);
  });

  async function signup(body?: {
    email?: string;
    password?: string;
    name?: string;
  }) {
    const res = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({
        email: body?.email ?? "user@test.com",
        password: body?.password ?? "password123",
        name: body?.name ?? "Test User",
      })
      .expect(201);

    return res.body as {
      token: string;
      user: { id: string; email: string; role: string };
    };
  }

  it("GET /health returns ok", async () => {
    await request(app.getHttpServer()).get("/health").expect(200).expect({
      ok: true,
    });
  });

  it("rejects unauthenticated trip access", async () => {
    await request(app.getHttpServer())
      .get("/api/trips")
      .expect(401)
      .expect({ error: "Unauthorized" });
  });

  it("signs up a new user in Postgres", async () => {
    const res = await signup({ email: "new@test.com", name: "New User" });

    expect(res.token).toEqual(expect.any(String));
    expect(res.user.email).toBe("new@test.com");
    expect(res.user.role).toBe("USER");

    const stored = await prisma.user.findUnique({
      where: { email: "new@test.com" },
    });
    expect(stored).toMatchObject({ email: "new@test.com", name: "New User" });
    expect(stored?.passwordHash).toEqual(expect.any(String));
  });

  it("rejects duplicate emails", async () => {
    await signup({ email: "dup@test.com" });
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({
        email: "dup@test.com",
        password: "password123",
      })
      .expect(409)
      .expect({ error: "An account with this email already exists" });
  });

  it("logs in and lists trips from Postgres", async () => {
    const { token } = await signup({ email: "owner@test.com" });

    await request(app.getHttpServer())
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Penang",
        description: "Food trip",
        startDate: "2026-10-01",
        endDate: "2026-10-04",
      })
      .expect(201);

    const trips = await request(app.getHttpServer())
      .get("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(trips.body).toEqual([
      expect.objectContaining({ title: "Penang", description: "Food trip" }),
    ]);
  });

  it("blocks non-admins from admin routes", async () => {
    const { token } = await signup({ email: "user@test.com" });

    await request(app.getHttpServer())
      .get("/api/admin/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(403)
      .expect({ error: "Admin access required" });
  });

  it("allows admin emails to read the admin summary", async () => {
    const { token, user } = await signup({ email: "admin@test.com" });
    expect(user.role).toBe("ADMIN");

    const summary = await request(app.getHttpServer())
      .get("/api/admin/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(summary.body).toEqual(
      expect.objectContaining({
        users: 1,
        trips: 0,
        locations: 0,
        activities: 0,
      }),
    );
  });

  it("creates a trip for an authenticated user", async () => {
    const { token } = await signup({ email: "traveler@test.com" });

    const res = await request(app.getHttpServer())
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Melaka",
        description: "Heritage",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
      })
      .expect(201);

    expect(res.body.title).toBe("Melaka");
    const trip = await prisma.trip.findFirst({
      where: { title: "Melaka" },
    });
    expect(trip?.description).toBe("Heritage");
  });

  it("does not list another user's trips", async () => {
    const owner = await signup({ email: "owner@test.com" });
    await request(app.getHttpServer())
      .post("/api/trips")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Owner trip",
        description: "Private",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
      })
      .expect(201);

    const other = await signup({ email: "other@test.com" });
    const trips = await request(app.getHttpServer())
      .get("/api/trips")
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);

    expect(trips.body).toEqual([]);
  });
});
