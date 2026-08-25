import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString("hex")}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, salt, key] = storedHash.split(":");
    if (algorithm !== "scrypt" || !salt || !key) return false;

    const storedKey = Buffer.from(key, "hex");
    const derivedKey = (await scrypt(
      password,
      salt,
      storedKey.length,
    )) as Buffer;

    if (storedKey.length !== derivedKey.length) return false;
    return timingSafeEqual(storedKey, derivedKey);
  }
}

const passwords = new PasswordService();

export function hashPassword(password: string) {
  return passwords.hash(password);
}

export function verifyPassword(password: string, storedHash: string) {
  return passwords.verify(password, storedHash);
}
