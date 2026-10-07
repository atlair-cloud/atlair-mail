import type { FastifyPluginAsync } from "fastify";
import bearerAuth from "@fastify/bearer-auth";
import rateLimit from "@fastify/rate-limit";

const v1Hooks: FastifyPluginAsync = async (fastify) => {
  await fastify.register(bearerAuth, {
    keys: [],
    verifyErrorLogLevel: "info",
    auth: async (token, request) => {
      request.apiKey = await fastify.apiKeys.verify(token);
      return request.apiKey !== null;
    },
  });

  await fastify.register(rateLimit, {
    hook: "preHandler",
    max: fastify.config.RATE_LIMIT_MAX,
    timeWindow: fastify.config.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => request.apiKey?.id ?? request.ip,
  });
};

export default v1Hooks;
