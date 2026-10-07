import Fastify from "fastify";
import autoload from "@fastify/autoload";
import helmet from "@fastify/helmet";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { join } from "node:path";
import configPlugin from "./config.ts";
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

  // Registered explicitly (not autoloaded) so every plugin below can read app.config.
  await app.register(configPlugin, { overrides: opts.env });
  app.log.level = app.config.LOG_LEVEL;

  await app.register(helmet, {
    // The /docs page runs an inline script that the default CSP blocks; CSP adds
    // little to the JSON responses that make up the rest of the API.
    contentSecurityPolicy: false,
  });

  // Shared plugins: each file is wrapped in fastify-plugin, so its decorators are app-wide.
  await app.register(autoload, {
    dir: join(import.meta.dirname, "plugins"),
  });

  // Routes: folders become URL prefixes, and an autohooks.ts applies to its folder and below.
  await app.register(autoload, {
    dir: join(import.meta.dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return app;
}
