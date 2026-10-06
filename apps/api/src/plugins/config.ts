import fp from "fastify-plugin";
import { loadEnv, type Env } from "../env.ts";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
  }
}

export default fp<{ overrides?: Partial<Env> }>(
  async function configPlugin(fastify, opts) {
    fastify.decorate("config", loadEnv(opts.overrides));
  },
  { name: "config" },
);
