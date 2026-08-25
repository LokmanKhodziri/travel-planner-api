import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { createPrismaMock } from "../src/testing/prisma.mock";
import { PasswordService } from "../src/auth/password.service";
import { TokenService } from "../src/auth/token.service";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import cookieParser from "cookie-parser";

describe("API e2e", () => {
  let app: INestApplication;
  const prisma = createPrismaMock();
  const passwords = new PasswordService();
  const tokens = new TokenService();

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("signs up a new user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "u1",
      email: "new@test.com",
      name: "New User",
      image: null,
      role: "USER",
    });
    prisma.session.create.mockResolvedValue({});

    const res = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({
        email: "new@test.com",
        password: "password123",
        name: "New User",
      })
      .expect(201);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("new@test.com");
  });

  it("logs in and lists trips", async () => {
    const passwordHash = await passwords.hash("password123");
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@test.com",
      name: "Lokman",
      image: null,
      role: "USER",
      passwordHash,
    });
    prisma.session.create.mockResolvedValue({});

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "user@test.com", password: "password123" })
      .expect(200);

    const token = login.body.token as string;
    prisma.session.findUnique.mockResolvedValue({
      sessionToken: token,
      expires: new Date(Date.now() + 60_000),
      user: {
        id: "u1",
        email: "user@test.com",
        name: "Lokman",
        image: null,
        role: "USER",
      },
    });
    prisma.session.update.mockResolvedValue({});
    prisma.trip.findMany.mockResolvedValue([
      { id: "t1", title: "Penang", userId: "u1" },
    ]);

    const trips = await request(app.getHttpServer())
      .get("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(trips.body).toEqual([
      expect.objectContaining({ id: "t1", title: "Penang" }),
    ]);
  });

  it("blocks non-admins from admin routes", async () => {
    const token = tokens.sign("u1");
    prisma.session.findUnique.mockResolvedValue({
      sessionToken: token,
      expires: new Date(Date.now() + 60_000),
      user: {
        id: "u1",
        email: "user@test.com",
        name: "Lokman",
        image: null,
        role: "USER",
      },
    });
    prisma.session.update.mockResolvedValue({});

    await request(app.getHttpServer())
      .get("/api/admin/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(403)
      .expect({ error: "Admin access required" });
  });

  it("creates a trip for an authenticated user", async () => {
    const token = tokens.sign("u1");
    prisma.session.findUnique.mockResolvedValue({
      sessionToken: token,
      expires: new Date(Date.now() + 60_000),
      user: {
        id: "u1",
        email: "user@test.com",
        name: "Lokman",
        image: null,
        role: "USER",
      },
    });
    prisma.session.update.mockResolvedValue({});
    prisma.trip.create.mockResolvedValue({
      id: "t2",
      title: "Melaka",
      description: "Heritage",
      userId: "u1",
    });

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
  });
});
