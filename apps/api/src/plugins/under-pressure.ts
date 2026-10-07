import fp from "fastify-plugin";
import underPressure from "@fastify/under-pressure";
import { ping } from "@atlair-mail/db";

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
      healthCheck: async () => {
        await ping(fastify.db);
        return { uptime: process.uptime() };
      },
      healthCheckInterval: 5000,
    });
  },
  { name: "under-pressure", dependencies: ["db"] },
);
