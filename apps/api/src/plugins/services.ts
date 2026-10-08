import fp from "fastify-plugin";
import { createApiKeyService, type ApiKeyService } from "../services/api-keys.ts";
import { createDomainService, type DomainService } from "../services/domains.ts";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";
import { createSesConnectionService, type SesConnectionService } from "../services/ses-connections.ts";

export interface Services {
  apiKeys: ApiKeyService;
  domains: DomainService;
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
    const sesConnections = createSesConnectionService(fastify.db, fastify.credentialsCipher);
    fastify.decorate("services", {
      apiKeys: createApiKeyService(fastify.db),
      domains: createDomainService(fastify.db, sesConnections),
      organizations: createOrganizationService(fastify.db),
      sesConnections,
    });
  },
  { name: "services", dependencies: ["db", "credentials-cipher"] },
);
