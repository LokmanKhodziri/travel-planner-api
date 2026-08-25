import { HttpException } from "@nestjs/common";

export function throwApiError(message: string, status: number): never {
  throw new HttpException({ error: message }, status);
}

export function rethrowOrWrap(
  error: unknown,
  message: string,
  status = 500,
): never {
  if (error instanceof HttpException) throw error;
  console.error(error);
  throwApiError(message, status);
}
