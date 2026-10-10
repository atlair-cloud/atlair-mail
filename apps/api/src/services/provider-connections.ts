import createError from "@fastify/error";
import {
  creatorColumns,
  deleteProviderConnection,
  editorColumns,
  findProviderConnectionByOrganization,
  hasPgErrorCode,
  pgErrorCodes,
  recordAudit,
  saveProviderEvents,
  upsertProviderConnection,
  type Actor,
  type Executor,
  type Database,
} from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import {
  loadProvider as loadStoredProvider,
  normalizePublicUrl,
  providerFromConnection,
  type CredentialsCipher,
} from "@atlair-mail/core";
import {
  createProvider,
  type EventDeliveryMode,
  type ProviderAccount,
  type ProviderConfig,
  type ProviderLogger,
} from "@atlair-mail/providers";
import { withAuthors } from "../lib/authors.ts";

export const ProviderNotConnectedError = createError(
  "ATL_PROVIDER_NOT_CONNECTED",
  "Connect an email provider with PUT /service/web/provider first",
  409,
);

export const ProviderAccountInUseError = createError(
  "ATL_PROVIDER_ACCOUNT_IN_USE",
  "This provider account is already used by another organization",
  409,
);

export const InvalidEventsUrlError = createError(
  "ATL_INVALID_EVENTS_URL",
  "url must be this server's public https address on a registered domain, without credentials, query or fragment",
  400,
);

export const InvalidEventsSetupError = createError(
  "ATL_INVALID_EVENTS_SETUP",
  "push mode needs url; pull mode takes no url",
  400,
);

export const EventQueueNotConfiguredError = createError(
  "ATL_EVENT_QUEUE_NOT_CONFIGURED",
  "Set up events with mode pull first",
  409,
);

export type EventsStatus = "disabled" | "pending_confirmation" | "confirmed" | "failing";

export interface EventsSetupInput {
  mode?: EventDeliveryMode;
  url?: string;
}

export interface SesProviderInput {
  type: "ses";
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type ProviderInput = SesProviderInput;

function toProviderConfig(input: ProviderInput): ProviderConfig {
  switch (input.type) {
    case "ses":
      return {
        type: "ses",
        settings: { region: input.region, accessKeyId: input.accessKeyId },
        secrets: { secretAccessKey: input.secretAccessKey },
      };
  }
}

const eventsStatus = (connection: ProviderConnection): EventsStatus => {
  if (!connection.eventsMode) return "disabled";
  if (connection.eventsMode === "pull" && connection.eventsLastError) return "failing";
  return connection.eventsConfirmedAt ? "confirmed" : "pending_confirmation";
};

const pullOnly = <T>(connection: ProviderConnection, value: T) => (connection.eventsMode === "pull" ? value : null);

const toPublicConnection = (connection: ProviderConnection) => ({
  id: connection.id,
  type: connection.provider,
  ...connection.settings,
  events: {
    mode: connection.eventsMode,
    url: connection.eventsUrl,
    status: eventsStatus(connection),
    confirmedAt: connection.eventsConfirmedAt,
    lastReceivedAt: pullOnly(connection, connection.eventsLastReceivedAt),
    nextCheckAt: pullOnly(connection, connection.eventsPollAfter),
    lastError: pullOnly(connection, connection.eventsLastError),
    backlog: pullOnly(connection, connection.eventsBacklog),
    deadLetters: pullOnly(connection, connection.eventsDeadLetters),
  },
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

const accountTtlMs = 5 * 60_000;

export const eventEndpoint = (eventsUrl: string, connectionId: string) =>
  `${eventsUrl}/webhooks/provider-events/${connectionId}`;

function auditEvents(
  db: Executor,
  connection: ProviderConnection,
  next: { mode: "push" | "pull"; url: string | null },
  actor: Actor,
) {
  return recordAudit(db, {
    organizationId: connection.organizationId,
    actor,
    action: connection.eventsMode ? "provider.events_changed" : "provider.events_enabled",
    entityType: "provider",
    entityId: connection.id,
    changes: {
      ...(connection.eventsMode && { before: { mode: connection.eventsMode, url: connection.eventsUrl } }),
      after: next,
    },
  });
}

export function createProviderConnectionService(db: Database, cipher: CredentialsCipher, logger: ProviderLogger) {
  const loadProvider = (organizationId: string) => loadStoredProvider(db, cipher, organizationId, { logger });
  const accounts = new Map<string, { checkedAt: number; account: ProviderAccount | null }>();
  const withConnectionAuthors = async (connection: ProviderConnection) => ({
    ...toPublicConnection(connection),
    ...(await withAuthors(db, connection)),
  });

  return {
    async save(organizationId: string, input: ProviderInput, actor: Actor) {
      const config = toProviderConfig(input);
      const account = await createProvider(config, { logger }).verifyAccount();
      const { ciphertext, keyVersion } = await cipher.encrypt(JSON.stringify(config.secrets), organizationId);
      const connection = await db
        .transaction(async (tx) => {
          const previous = await findProviderConnectionByOrganization(tx, organizationId);
          const saved = await upsertProviderConnection(tx, {
            organizationId,
            provider: config.type,
            settings: config.settings,
            accountId: account.accountId,
            credentialsEncrypted: ciphertext,
            encryptionKeyVersion: keyVersion,
            ...creatorColumns(actor),
            ...editorColumns(actor),
          });
          await recordAudit(tx, {
            organizationId,
            actor,
            action: previous ? "provider.credentials_replaced" : "provider.connected",
            entityType: "provider",
            entityId: saved.id,
            changes: {
              type: saved.provider,
              ...(previous && { before: { region: previous.settings.region, accessKeyId: previous.settings.accessKeyId } }),
              after: { region: saved.settings.region, accessKeyId: saved.settings.accessKeyId },
            },
          });
          return saved;
        })
        .catch((error: unknown) => {
          if (hasPgErrorCode(error, pgErrorCodes.uniqueViolation)) throw new ProviderAccountInUseError();
          throw error;
        });
      accounts.set(organizationId, { checkedAt: Date.now(), account });
      return { ...(await withConnectionAuthors(connection)), account };
    },

    async setUpEvents(organizationId: string, input: EventsSetupInput, actor: Actor) {
      const mode = input.mode ?? "push";
      if ((mode === "push") !== (input.url !== undefined)) throw new InvalidEventsSetupError();
      const eventsUrl = mode === "push" ? normalizePublicUrl(input.url!) : null;
      if (mode === "push" && !eventsUrl) throw new InvalidEventsUrlError();
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      if (!connection) throw new ProviderNotConnectedError();
      const provider = await providerFromConnection(cipher, connection, { logger });

      if (eventsUrl) {
        const { settings } = await provider.configureEvents(connection.id, {
          mode: "push",
          endpointUrl: eventEndpoint(eventsUrl, connection.id),
        });
        const saved = await db.transaction(async (tx) => {
          const row = await saveProviderEvents(tx, connection.id, { mode: "push", settings, eventsUrl, active: false }, actor);
          await auditEvents(tx, connection, { mode: "push", url: eventsUrl }, actor);
          return row;
        });
        return withConnectionAuthors(saved ?? connection);
      }

      const { settings, subscriptionActive } = await provider.configureEvents(connection.id, { mode: "pull" });
      const saved = await db.transaction(async (tx) => {
        const row = await saveProviderEvents(tx, connection.id, { mode: "pull", settings, active: subscriptionActive }, actor);
        await auditEvents(tx, connection, { mode: "pull", url: null }, actor);
        return row;
      });
      if (subscriptionActive) {
        await provider.removeEventSubscriptions(connection.id, "push").catch((error: unknown) => {
          logger.warn({ connectionId: connection.id, err: error }, "could not remove the push subscription");
        });
      }
      return withConnectionAuthors(saved ?? connection);
    },

    async redriveEvents(organizationId: string, actor: Actor) {
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      if (!connection) throw new ProviderNotConnectedError();
      if (connection.eventsMode !== "pull" || !connection.settings.eventQueueUrl) {
        throw new EventQueueNotConfiguredError();
      }
      const provider = await providerFromConnection(cipher, connection, { logger });
      await provider.redriveEventMessages();
      await recordAudit(db, {
        organizationId,
        actor,
        action: "provider.events_redriven",
        entityType: "provider",
        entityId: connection.id,
        changes: { deadLetters: connection.eventsDeadLetters },
      });
      return { status: "started" as const };
    },

    async get(organizationId: string) {
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      return connection && withConnectionAuthors(connection);
    },

    remove: (organizationId: string, actor: Actor) => {
      accounts.delete(organizationId);
      return db.transaction(async (tx) => {
        const removed = await deleteProviderConnection(tx, organizationId);
        if (removed) {
          await recordAudit(tx, {
            organizationId,
            actor,
            action: "provider.disconnected",
            entityType: "provider",
            entityId: removed.id,
            changes: { region: removed.settings.region, accessKeyId: removed.settings.accessKeyId },
          });
        }
        return removed;
      });
    },

    async account(organizationId: string) {
      const cached = accounts.get(organizationId);
      if (cached && Date.now() - cached.checkedAt < accountTtlMs) return cached.account;
      const account = await loadProvider(organizationId)
        .then((provider) => provider?.verifyAccount() ?? null)
        .catch((error: unknown) => {
          logger.warn({ organizationId, err: error }, "could not read the provider account");
          return null;
        });
      accounts.set(organizationId, { checkedAt: Date.now(), account });
      return account;
    },

    loadProvider,

    async requireProvider(organizationId: string) {
      const provider = await loadProvider(organizationId);
      if (!provider) throw new ProviderNotConnectedError();
      return provider;
    },
  };
}

export type ProviderConnectionService = ReturnType<typeof createProviderConnectionService>;
