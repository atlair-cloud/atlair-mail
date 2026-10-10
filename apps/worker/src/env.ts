import envSchema from "env-schema";
import { Type, type Static } from "typebox";

const schema = Type.Object({
  DATABASE_URL: Type.String({ default: "postgres://atlair:atlair@localhost:5432/atlair_mail" }),
  DATABASE_LISTEN_URL: Type.Optional(Type.String({ minLength: 1 })),
  CREDENTIALS_ENCRYPTION_KEYS: Type.String({ minLength: 1 }),
  LOG_LEVEL: Type.Union(
    ["trace", "debug", "info", "warn", "error", "fatal", "silent"].map((level) => Type.Literal(level)),
    { default: "info" },
  ),
  PORT: Type.Number({ default: 8081 }),
  HOST: Type.String({ default: "0.0.0.0" }),
  WORKER_CONCURRENCY: Type.Integer({ minimum: 1, maximum: 100, default: 10 }),
});

export type WorkerEnv = Static<typeof schema>;

export function loadEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return envSchema<WorkerEnv>({ schema, data: overrides });
}
