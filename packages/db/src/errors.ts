import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";

export const pgErrorCodes = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  checkViolation: "23514",
} as const;

export function hasPgErrorCode(error: unknown, code: string) {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof postgres.PostgresError &&
    error.cause.code === code
  );
}
