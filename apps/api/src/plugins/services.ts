import fp from "fastify-plugin";
import { createApiKeyService, type ApiKeyService } from "../services/api-keys.ts";
import { createAuditLogService, type AuditLogService } from "../services/audit-logs.ts";
import { createDomainService, type DomainService } from "../services/domains.ts";
import { createEmailEventService, type EmailEventService } from "../services/email-events.ts";
import { createEmailService, type EmailService } from "../services/emails.ts";
import { createMemberService, type MemberService } from "../services/members.ts";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";
import { createOverviewService, type OverviewService } from "../services/overview.ts";
import { createProviderEventService, type ProviderEventService } from "../services/provider-events.ts";
import { createRoleService, type RoleService } from "../services/roles.ts";
import { createSuppressionService, type SuppressionService } from "../services/suppressions.ts";
import { createWebhookService, type WebhookService } from "../services/webhooks.ts";
import {
  createProviderConnectionService,
  type ProviderConnectionService,
} from "../services/provider-connections.ts";

export interface Services {
  apiKeys: ApiKeyService;
  auditLogs: AuditLogService;
  domains: DomainService;
  emails: EmailService;
  emailEvents: EmailEventService;
  members: MemberService;
  organizations: OrganizationService;
  overview: OverviewService;
  providerConnections: ProviderConnectionService;
  providerEvents: ProviderEventService;
  roles: RoleService;
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
    const emails = createEmailService(fastify.db);
    fastify.decorate("services", {
      apiKeys: createApiKeyService(fastify.db),
      auditLogs: createAuditLogService(fastify.db),
      domains: createDomainService(fastify.db, providerConnections),
      emails,
      emailEvents,
      members: createMemberService(fastify.db),
      organizations: createOrganizationService(fastify.db),
      overview: createOverviewService(fastify.db, emails),
      providerConnections,
      providerEvents: createProviderEventService(
        fastify.db,
        fastify.credentialsCipher,
        fastify.log.child({ component: "provider-events" }),
      ),
      roles: createRoleService(fastify.db),
      suppressions: createSuppressionService(fastify.db),
      webhooks: createWebhookService(fastify.db, fastify.credentialsCipher),
    });
  },
  { name: "services", dependencies: ["db", "credentials-cipher"] },
);
