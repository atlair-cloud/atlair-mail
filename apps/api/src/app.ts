import Fastify from "fastify";
import helmet from "@fastify/helmet";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import configPlugin from "./plugins/config.ts";
import healthRoutes from "./routes/health.ts";
import type { Env } from "./env.ts";

export interface BuildAppOptions {
  /** Takes precedence over process.env; tests use it to pin config. */
  env?: Partial<Env>;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    logger: {
      redact: ["req.headers.authorization"],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(configPlugin, { overrides: opts.env });
  app.log.level = app.config.LOG_LEVEL;

  await app.register(helmet);

  await app.register(healthRoutes);

  return app;
}
