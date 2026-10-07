import fp from "fastify-plugin";
import { createApiKeyService, type ApiKeyService } from "../services/api-keys.ts";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";

export interface Services {
  apiKeys: ApiKeyService;
  organizations: OrganizationService;
}

declare module "fastify" {
  interface FastifyInstance {
    services: Services;
  }
}

export default fp(
  async function servicesPlugin(fastify) {
    fastify.decorate("services", {
      apiKeys: createApiKeyService(fastify.db),
      organizations: createOrganizationService(fastify.db),
    });
  },
  { name: "services", dependencies: ["db"] },
);
