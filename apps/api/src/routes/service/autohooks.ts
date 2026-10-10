import type { FastifyPluginAsync } from "fastify";
import { apiVersionHeader, defaultApiVersion, requestedApiVersion } from "../../lib/api-version.ts";

const serviceHooks: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRoute", (route) => {
    const versions = route.config?.version ?? [defaultApiVersion];
    route.constraints = { ...route.constraints, apiVersion: versions };
    for (const version of versions) fastify.apiVersions.add(version);
  });

  fastify.addHook("onSend", async (request, reply) => {
    reply.header(apiVersionHeader, requestedApiVersion(request.headers));
    const vary = reply.getHeader("vary");
    reply.header("vary", vary ? `${vary}, ${apiVersionHeader}` : apiVersionHeader);
  });
};

export default serviceHooks;
