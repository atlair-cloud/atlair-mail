import envSchema from "env-schema";
import { Type, type Static } from "typebox";

const schema = Type.Object({
  PORT: Type.Number({ default: 8080 }),
  HOST: Type.String({ default: "0.0.0.0" }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal("trace"),
      Type.Literal("debug"),
      Type.Literal("info"),
      Type.Literal("warn"),
      Type.Literal("error"),
      Type.Literal("fatal"),
      Type.Literal("silent"),
    ],
    { default: "info" },
  ),
  DATABASE_URL: Type.String({ default: "postgres://atlair:atlair@localhost:5432/atlair_mail" }),
  RATE_LIMIT_MAX: Type.Number({ default: 100 }),
  RATE_LIMIT_WINDOW: Type.String({ default: "1 minute" }),
});

export type Env = Static<typeof schema>;

export function loadEnv(overrides: Partial<Env> = {}): Env {
  return envSchema<Env>({ schema, data: overrides });
}
