import fp from "fastify-plugin";
import { createApiKeyService, type ApiKeyService } from "../services/api-keys.ts";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";
import { createSesConnectionService, type SesConnectionService } from "../services/ses-connections.ts";

export interface Services {
  apiKeys: ApiKeyService;
  organizations: OrganizationService;
  sesConnections: SesConnectionService;
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
      sesConnections: createSesConnectionService(fastify.db, fastify.credentialsCipher),
    });
  },
  { name: "services", dependencies: ["db", "credentials-cipher"] },
);
