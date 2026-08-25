import { ExecutionContext, HttpException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { TokenService } from "../../auth/token.service";
import { createPrismaMock } from "../../testing/prisma.mock";

function mockContext(headers: Record<string, string> = {}) {
  const req: { headers: Record<string, string>; cookies: Record<string, string>; user?: unknown } = {
    headers,
    cookies: {},
  };
  return {
    req,
    context: {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext,
  };
}

describe("JwtAuthGuard", () => {
  const prisma = createPrismaMock();
  const tokens = new TokenService();
  const guard = new JwtAuthGuard(prisma as never, tokens);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("rejects missing tokens", async () => {
    const { context } = mockContext();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
  });

  it("rejects invalid tokens", async () => {
    const { context } = mockContext({ authorization: "Bearer not-valid" });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
  });

  it("rejects expired sessions and deletes them", async () => {
    const token = tokens.sign("user-1");
    prisma.session.findUnique.mockResolvedValue({
      sessionToken: token,
      expires: new Date(Date.now() - 1000),
      user: {
        id: "user-1",
        email: "user@test.com",
        name: null,
        image: null,
        role: "USER",
      },
    });
    prisma.session.delete.mockResolvedValue({});

    const { context } = mockContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { error: "Session expired" },
    });
    expect(prisma.session.delete).toHaveBeenCalled();
  });

  it("attaches the user and slides the session window", async () => {
    const token = tokens.sign("user-1");
    prisma.session.findUnique.mockResolvedValue({
      sessionToken: token,
      expires: new Date(Date.now() + 60_000),
      user: {
        id: "user-1",
        email: "user@test.com",
        name: "Lokman",
        image: null,
        role: "USER",
      },
    });
    prisma.session.update.mockResolvedValue({});

    const { req, context } = mockContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: "user-1", email: "user@test.com" });
    expect(prisma.session.update).toHaveBeenCalled();
  });
});
