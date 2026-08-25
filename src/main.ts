import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const allowedOrigins = new Set(
    [
      frontendUrl,
      ...(process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ].filter(Boolean),
  );

  function isAllowedVercelPreview(origin: string) {
    const previewPattern = process.env.VERCEL_PREVIEW_ORIGIN_REGEX;
    if (!previewPattern) return false;
    try {
      return new RegExp(previewPattern).test(origin);
    } catch {
      console.warn("Invalid VERCEL_PREVIEW_ORIGIN_REGEX value");
      return false;
    }
  }

  app.enableCors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        isAllowedVercelPreview(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);
  console.log(`Musafir-Go API listening on http://${host}:${port}`);
}

void bootstrap();
