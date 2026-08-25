import { HttpException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { createPrismaMock } from "../testing/prisma.mock";

describe("AuthService", () => {
  const prisma = createPrismaMock();
  const passwords = new PasswordService();
  const tokens = new TokenService();
  const auth = new AuthService(prisma as never, passwords, tokens);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.ADMIN_EMAILS = "admin@test.com";
  });

  it("rejects signup without a valid email/password", async () => {
    await expect(auth.signup({ email: "bad", password: "short" })).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it("rejects duplicate emails", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1" });
    await expect(
      auth.signup({ email: "user@test.com", password: "password123" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("creates a user and session on signup", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "u1",
      email: "user@test.com",
      name: "Lokman",
      image: null,
      role: "USER",
    });
    prisma.session.create.mockResolvedValue({});

    const result = await auth.signup({
      email: "user@test.com",
      password: "password123",
      name: "Lokman",
    });

    expect(result.user.email).toBe("user@test.com");
    expect(result.token).toEqual(expect.any(String));
    expect(prisma.session.create).toHaveBeenCalled();
  });

  it("rejects login for an unknown user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      auth.login({ email: "missing@test.com", password: "password123" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("logs in with a valid password", async () => {
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

    const result = await auth.login({
      email: "user@test.com",
      password: "password123",
    });
    expect(result.user.id).toBe("u1");
    expect(result.token).toEqual(expect.any(String));
  });
});
