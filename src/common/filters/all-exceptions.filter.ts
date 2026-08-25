import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body && "error" in body) {
        response.status(status).json(body);
        return;
      }
      const message =
        typeof body === "string"
          ? body
          : Array.isArray((body as { message?: unknown }).message)
            ? (body as { message: string[] }).message[0]
            : ((body as { message?: string }).message ?? exception.message);
      response.status(status).json({ error: message });
      return;
    }

    console.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: "Internal server error" });
  }
}
