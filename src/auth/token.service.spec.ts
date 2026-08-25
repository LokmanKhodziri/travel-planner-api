import { TokenService } from "./token.service";

describe("TokenService", () => {
  const tokens = new TokenService();

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("signs and verifies a user id", () => {
    const token = tokens.sign("user-1");
    expect(tokens.verify(token)).toEqual(expect.objectContaining({ sub: "user-1" }));
  });

  it("returns null for an invalid token", () => {
    expect(tokens.verify("not-a-jwt")).toBeNull();
  });

  it("reads Bearer tokens from the Authorization header", () => {
    const req = {
      headers: { authorization: "Bearer abc.def" },
      cookies: {},
    } as never;
    expect(tokens.getTokenFromRequest(req)).toBe("abc.def");
  });

  it("falls back to the jwt cookie", () => {
    const req = {
      headers: {},
      cookies: { jwt: "cookie-token" },
    } as never;
    expect(tokens.getTokenFromRequest(req)).toBe("cookie-token");
  });
});
