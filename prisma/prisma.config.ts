import { defineConfig } from "@prisma/client";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrate: {
    // Connection URL for migrations only
    url: process.env.DATABASE_URL,
  },
});
