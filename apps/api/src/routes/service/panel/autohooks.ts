import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const panelHooks: FastifyPluginAsync = async (fastify) => {
  const origins = new Set(fastify.panelOrigins);

  fastify.addHook("onRequest", async (request, reply) => {
    if (!safeMethods.has(request.method) && !origins.has(request.headers.origin ?? "")) {
      throw fastify.httpErrors.forbidden("Request origin is not allowed");
    }
    await fastify.requireSession(request, reply);
  });

  await fastify.register(rateLimit, {
    hook: "preHandler",
    max: fastify.config.RATE_LIMIT_MAX,
    timeWindow: fastify.config.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => `user:${request.user?.id ?? request.ip}`,
  });
};

export default panelHooks;
