import { execSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaService } from "../src/prisma/prisma.service";

const TEST_DB_NAME = "musafir_test";
const TEST_DB_USER = "musafir";
const TEST_DB_PASSWORD = "musafir";
const TEST_DB_PORT = Number(process.env.TEST_DATABASE_PORT) || 55432;

let child: ChildProcess | null = null;
let dataDir: string | null = null;

export async function startTestDatabase(): Promise<string> {
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    pushSchema(process.env.TEST_DATABASE_URL);
    return process.env.TEST_DATABASE_URL;
  }

  await stopTestDatabase();
  try {
    execSync(`fuser -k ${TEST_DB_PORT}/tcp`, { stdio: "ignore" });
  } catch {
    // No leftover process on the test port
  }

  dataDir = await mkdtemp(path.join(tmpdir(), "musafir-pg-"));
  const worker = path.join(__dirname, "embedded-pg.mjs");

  await new Promise<void>((resolve, reject) => {
    child = spawn(process.execPath, [worker], {
      env: {
        ...process.env,
        TEST_PG_DATA_DIR: dataDir as string,
        TEST_DATABASE_PORT: String(TEST_DB_PORT),
        TEST_PG_USER: TEST_DB_USER,
        TEST_PG_PASSWORD: TEST_DB_PASSWORD,
        TEST_PG_DATABASE: TEST_DB_NAME,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      reject(new Error("Embedded Postgres did not become ready in time"));
    }, 90_000);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("READY")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Embedded Postgres exited with code ${code}`));
      }
    });
  });

  const url = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@127.0.0.1:${TEST_DB_PORT}/${TEST_DB_NAME}`;
  process.env.DATABASE_URL = url;
  pushSchema(url);
  return url;
}

export async function stopTestDatabase() {
  if (child?.pid) {
    const pid = child.pid;
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      child?.once("exit", finish);
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        finish();
      }
      setTimeout(finish, 2_000);
    });
    child = null;
  }
  try {
    execSync(`fuser -k ${TEST_DB_PORT}/tcp`, { stdio: "ignore" });
  } catch {
    // Port already free
  }
  if (dataDir) {
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
    dataDir = null;
  }
}

export async function resetTestDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TripExpense",
      "TripBudget",
      "ItineraryActivity",
      "Location",
      "Trip",
      "Session",
      "Account",
      "VerificationToken",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

function pushSchema(url: string) {
  execSync(
    `npx prisma db push --accept-data-loss --url ${JSON.stringify(url)}`,
    {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        DATABASE_URL: url,
      },
    },
  );
}
