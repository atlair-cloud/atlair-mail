import Fastify from "fastify";
import autoload from "@fastify/autoload";
import helmet from "@fastify/helmet";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { join } from "node:path";
import configPlugin from "./config.ts";
import type { Env } from "./env.ts";

export interface BuildAppOptions {
  env?: Partial<Env>;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "secretAccessKey",
        "*.secretAccessKey",
        "*.*.secretAccessKey",
      ],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(configPlugin, { overrides: opts.env });
  app.log.level = app.config.LOG_LEVEL;

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(autoload, {
    dir: join(import.meta.dirname, "plugins"),
  });

  await app.register(autoload, {
    dir: join(import.meta.dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return app;
}
