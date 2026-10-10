import fp from "fastify-plugin";
import underPressure from "@fastify/under-pressure";

export default fp(
  async function underPressurePlugin(fastify) {
    await fastify.register(underPressure, {
      maxEventLoopDelay: 1000,
      maxEventLoopUtilization: 0.98,
      retryAfter: 10,
      exposeStatusRoute: {
        url: "/health",
        routeOpts: { logLevel: "warn" },
        routeSchemaOpts: { security: [] },
        routeResponseSchemaOpts: { uptime: { type: "number" } },
      },
      healthCheck: async () => ({ uptime: process.uptime() }),
    });
  },
  { name: "under-pressure" },
);
