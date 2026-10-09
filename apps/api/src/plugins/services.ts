import fp from "fastify-plugin";
import { createApiKeyService, type ApiKeyService } from "../services/api-keys.ts";
import { createDomainService, type DomainService } from "../services/domains.ts";
import { createEmailEventService, type EmailEventService } from "../services/email-events.ts";
import { createEmailService, type EmailService } from "../services/emails.ts";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";
import { createProviderEventService, type ProviderEventService } from "../services/provider-events.ts";
import { createSuppressionService, type SuppressionService } from "../services/suppressions.ts";
import { createWebhookService, type WebhookService } from "../services/webhooks.ts";
import {
  createProviderConnectionService,
  type ProviderConnectionService,
} from "../services/provider-connections.ts";

export interface Services {
  apiKeys: ApiKeyService;
  domains: DomainService;
  emails: EmailService;
  emailEvents: EmailEventService;
  organizations: OrganizationService;
  providerConnections: ProviderConnectionService;
  providerEvents: ProviderEventService;
  suppressions: SuppressionService;
  webhooks: WebhookService;
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
    const emailEvents = createEmailEventService(fastify.db);
    fastify.decorate("services", {
      apiKeys: createApiKeyService(fastify.db),
      domains: createDomainService(fastify.db, providerConnections),
      emails: createEmailService(fastify.db),
      emailEvents,
      organizations: createOrganizationService(fastify.db),
      providerConnections,
      providerEvents: createProviderEventService(
        fastify.db,
        fastify.credentialsCipher,
        emailEvents,
        fastify.log.child({ component: "provider-events" }),
      ),
      suppressions: createSuppressionService(fastify.db),
      webhooks: createWebhookService(fastify.db, fastify.credentialsCipher),
    });
  },
  { name: "services", dependencies: ["db", "credentials-cipher"] },
);
