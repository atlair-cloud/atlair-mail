import type { FastifyPluginAsync } from "fastify";
import bearerAuth from "@fastify/bearer-auth";
import rateLimit from "@fastify/rate-limit";

const v1Hooks: FastifyPluginAsync = async (fastify) => {
  await fastify.register(bearerAuth, {
    keys: [],
    verifyErrorLogLevel: "info",
    auth: async (token, request) => {
      if (fastify.apiKeys.isRootKey(token)) {
        request.isRootKey = true;
        return true;
      }
      request.apiKey = await fastify.apiKeys.verify(token);
      return request.apiKey !== null;
    },
  });

  fastify.addHook("preHandler", async (request) => {
    const access = request.routeOptions.config.access ?? "organization";
    if (access === "root" && !request.isRootKey) {
      throw fastify.httpErrors.forbidden("This route requires the root API key");
    }
    if (access === "organization" && request.apiKey === null) {
      throw fastify.httpErrors.forbidden("This route requires an organization API key");
    }
  });

  await fastify.register(rateLimit, {
    hook: "preHandler",
    max: fastify.config.RATE_LIMIT_MAX,
    timeWindow: fastify.config.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => request.apiKey?.id ?? (request.isRootKey ? "root" : request.ip),
  });
};

export default v1Hooks;
