import fp from "fastify-plugin";
import { createApiKeyService, type ApiKeyService } from "../services/api-keys.ts";
import { createDomainService, type DomainService } from "../services/domains.ts";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";
import {
  createProviderConnectionService,
  type ProviderConnectionService,
} from "../services/provider-connections.ts";

export interface Services {
  apiKeys: ApiKeyService;
  domains: DomainService;
  organizations: OrganizationService;
  providerConnections: ProviderConnectionService;
}

declare module "fastify" {
  interface FastifyInstance {
    services: Services;
  }
}

export default fp(
  async function servicesPlugin(fastify) {
    const providerConnections = createProviderConnectionService(
      fastify.db,
      fastify.credentialsCipher,
      fastify.log.child({ component: "provider" }),
    );
    fastify.decorate("services", {
      apiKeys: createApiKeyService(fastify.db),
      domains: createDomainService(fastify.db, providerConnections),
      organizations: createOrganizationService(fastify.db),
      providerConnections,
    });
  },
  { name: "services", dependencies: ["db", "credentials-cipher"] },
);
