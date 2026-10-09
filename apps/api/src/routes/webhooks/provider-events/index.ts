import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import rateLimit from "@fastify/rate-limit";
import { Type } from "typebox";
import { Uuid } from "../../../lib/schemas.ts";

export const maxEventBodyBytes = 256 * 1024;
export const eventsPerIpPerMinute = 3_000;

const providerEventRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const parseJson = fastify.getDefaultJsonParser("error", "error");
  fastify.removeContentTypeParser(["text/plain", "application/json"]);
  fastify.addContentTypeParser(["text/plain", "application/json"], { parseAs: "string" }, parseJson);

  await fastify.register(rateLimit, {
    max: eventsPerIpPerMinute,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });

  fastify.post(
    "/:connectionId",
    {
      bodyLimit: maxEventBodyBytes,
      schema: {
        summary: "Receive provider events",
        description:
          "Called by the connected provider's notification service, not by API clients. Every message must be signed and come from the topic set up for this connection.",
        tags: ["Webhooks"],
        security: [],
        params: Type.Object({ connectionId: Uuid() }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const { connectionId } = request.params;
      const received = await fastify.services.providerEvents.receive(connectionId, request.body);
      if (!received) throw fastify.httpErrors.notFound("Unknown connection");
      request.log.info({ connectionId, ...received }, "provider event received");
      return reply.code(204).send(null);
    },
  );
};

export default providerEventRoutes;
