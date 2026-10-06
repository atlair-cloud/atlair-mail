import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

const HealthResponse = Type.Object({
  status: Type.Literal("ok"),
  uptime: Type.Number(),
});

const healthRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/health",
    { schema: { response: { 200: HealthResponse } } },
    async () => ({ status: "ok" as const, uptime: process.uptime() }),
  );
};

export default healthRoutes;
