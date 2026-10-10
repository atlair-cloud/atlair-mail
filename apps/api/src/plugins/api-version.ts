import fp from "fastify-plugin";
import { requestedApiVersion } from "../lib/api-version.ts";

declare module "fastify" {
  interface FastifyInstance {
    apiVersions: Set<string>;
  }
  interface FastifyContextConfig {
    version?: string[];
  }
}

export default fp(
  async function apiVersionPlugin(fastify) {
    fastify.decorate("apiVersions", new Set<string>());

    fastify.setNotFoundHandler(async (request) => {
      const version = requestedApiVersion(request.headers);
      if (request.url.startsWith("/service/") && !fastify.apiVersions.has(version)) {
        const supported = [...fastify.apiVersions].sort().join(", ");
        throw fastify.httpErrors.badRequest(`Unsupported API version ${version}. Supported versions: ${supported}`);
      }
      throw fastify.httpErrors.notFound(`Route ${request.method}:${request.url} not found`);
    });
  },
  { name: "api-version", dependencies: ["sensible"] },
);
