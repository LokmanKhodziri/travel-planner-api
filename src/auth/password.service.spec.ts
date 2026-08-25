import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const passwords = new PasswordService();

  it("hashes and verifies a matching password", async () => {
    const hash = await passwords.hash("correct-horse");
    expect(hash.startsWith("scrypt:")).toBe(true);
    await expect(passwords.verify("correct-horse", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await passwords.hash("correct-horse");
    await expect(passwords.verify("wrong-password", hash)).resolves.toBe(false);
  });

  it("rejects a malformed stored hash", async () => {
    await expect(passwords.verify("anything", "not-a-hash")).resolves.toBe(
      false,
    );
  });
});
