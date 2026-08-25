import { mkdir } from "node:fs/promises";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.TEST_DATABASE_PORT || 55432);
const dataDir = process.env.TEST_PG_DATA_DIR;
const user = process.env.TEST_PG_USER || "musafir";
const password = process.env.TEST_PG_PASSWORD || "musafir";
const database = process.env.TEST_PG_DATABASE || "musafir_test";

if (!dataDir) {
  throw new Error("TEST_PG_DATA_DIR is required");
}

await mkdir(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: false,
  onLog: () => undefined,
});

await pg.initialise();
await pg.start();
await pg.createDatabase(database);

process.stdout.write("READY\n");

const stop = async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
};

process.on("SIGTERM", () => {
  void stop();
});
process.on("SIGINT", () => {
  void stop();
});
