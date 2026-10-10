import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { ping } from "@atlair-mail/db";

const healthRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/ready",
    {
      logLevel: "warn",
      schema: {
        summary: "Check readiness",
        description: "Returns 200 when the API can reach its database, and 503 when it can't. `/health` only checks that the process is up.",
        tags: ["Health"],
        security: [],
        response: { 200: Type.Object({ status: Type.Literal("ok") }) },
      },
    },
    async (_request, reply) => {
      try {
        await ping(fastify.db);
      } catch (error) {
        reply.header("retry-after", 10);
        throw Object.assign(fastify.httpErrors.serviceUnavailable("Database unreachable"), { cause: error });
      }
      return { status: "ok" as const };
    },
  );
};

export default healthRoutes;
