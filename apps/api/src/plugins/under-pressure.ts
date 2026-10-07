import fp from "fastify-plugin";
import underPressure from "@fastify/under-pressure";
import { ping } from "@atlair-mail/db";

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
      // A failed check marks the process unhealthy, which turns every route into a 503.
      // Re-running it on an interval lets the app recover once Postgres is back.
      healthCheck: async () => {
        await ping(fastify.db);
        return { uptime: process.uptime() };
      },
      healthCheckInterval: 5000,
    });
  },
  { name: "under-pressure", dependencies: ["db"] },
);
