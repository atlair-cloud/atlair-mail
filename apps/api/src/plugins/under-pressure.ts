import fp from "fastify-plugin";
import underPressure from "@fastify/under-pressure";

export default fp(
  async function underPressurePlugin(fastify) {
    await fastify.register(underPressure, {
      // Above these, every route answers 503 + Retry-After instead of queueing more work.
      maxEventLoopDelay: 1000,
      maxEventLoopUtilization: 0.98,
      retryAfter: 10,
      exposeStatusRoute: {
        url: "/health",
        // Load balancers poll this constantly; keep it out of info-level request logs.
        routeOpts: { logLevel: "warn" },
        routeSchemaOpts: { security: [] },
        routeResponseSchemaOpts: { uptime: { type: "number" } },
      },
      // Whatever this returns is merged into the /health body. Add a Postgres ping here.
      healthCheck: async () => ({ uptime: process.uptime() }),
    });
  },
  { name: "under-pressure" },
);
