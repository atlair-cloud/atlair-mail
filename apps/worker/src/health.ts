import { createServer } from "node:http";
import type { Logger } from "pino";

export interface HealthServerOptions {
  logger: Logger;
  host: string;
  port: number;
}

export function createHealthServer({ logger, host, port }: HealthServerOptions) {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://internal").pathname;
    if (request.method === "GET" && (path === "/" || path === "/health")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }
    response.writeHead(404);
    response.end();
  });

  return {
    start() {
      server.listen(port, host, () => logger.info({ host, port }, "health server started"));
    },
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      logger.info("health server stopped");
    },
  };
}

export type HealthServer = ReturnType<typeof createHealthServer>;
