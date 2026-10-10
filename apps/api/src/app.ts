import Fastify from "fastify";
import autoload from "@fastify/autoload";
import helmet from "@fastify/helmet";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { join } from "node:path";
import configPlugin from "./config.ts";
import { apiVersionConstraint } from "./lib/api-version.ts";
import type { Env } from "./env.ts";

export interface BuildAppOptions {
  env?: Partial<Env>;
  logStream?: { write(line: string): void };
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    routerOptions: { constraints: { apiVersion: apiVersionConstraint } },
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "secretAccessKey",
        "*.secretAccessKey",
        "*.*.secretAccessKey",
        "secrets",
        "*.secrets",
        "*.*.secrets",
      ],
      stream: opts.logStream,
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

  const panelEnabled = app.config.BETTER_AUTH_SECRET !== "";
  await app.register(autoload, {
    dir: join(import.meta.dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
    routeParams: true,
    ignoreFilter: (path) => !panelEnabled && path.includes("/service/panel/"),
  });

  return app;
}
