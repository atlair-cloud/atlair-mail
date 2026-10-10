import type { FastifyPluginAsync } from "fastify";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const panelHooks: FastifyPluginAsync = async (fastify) => {
  const origins = new Set(fastify.panelOrigins);

  fastify.addHook("onRequest", async (request, reply) => {
    if (!safeMethods.has(request.method) && !origins.has(request.headers.origin ?? "")) {
      throw fastify.httpErrors.forbidden("Request origin is not allowed");
    }
    await fastify.requireSession(request, reply);
  });
};

export default panelHooks;
