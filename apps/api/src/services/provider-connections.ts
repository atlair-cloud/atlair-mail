import createError from "@fastify/error";
import {
  deleteProviderConnection,
  findProviderConnectionByOrganization,
  saveProviderEvents,
  upsertProviderConnection,
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
  type ProviderConfig,
  type ProviderLogger,
} from "@atlair-mail/providers";

export const ProviderNotConnectedError = createError(
  "ATL_PROVIDER_NOT_CONNECTED",
  "Connect an email provider with PUT /service/web/provider first",
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
    lastError: pullOnly(connection, connection.eventsLastError),
    backlog: pullOnly(connection, connection.eventsBacklog),
    deadLetters: pullOnly(connection, connection.eventsDeadLetters),
  },
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

export const eventEndpoint = (eventsUrl: string, connectionId: string) =>
  `${eventsUrl}/webhooks/provider-events/${connectionId}`;

export function createProviderConnectionService(db: Database, cipher: CredentialsCipher, logger: ProviderLogger) {
  const loadProvider = (organizationId: string) => loadStoredProvider(db, cipher, organizationId, { logger });


  return {
    async save(organizationId: string, input: ProviderInput) {
      const config = toProviderConfig(input);
      const account = await createProvider(config, { logger }).verifyAccount();
      const { ciphertext, keyVersion } = await cipher.encrypt(JSON.stringify(config.secrets), organizationId);
      const connection = await upsertProviderConnection(db, {
        organizationId,
        provider: config.type,
        settings: config.settings,
        credentialsEncrypted: ciphertext,
        encryptionKeyVersion: keyVersion,
      });
      return { ...toPublicConnection(connection), account };
    },

    async setUpEvents(organizationId: string, input: EventsSetupInput) {
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
        const saved = await saveProviderEvents(db, connection.id, { mode: "push", settings, eventsUrl, active: false });
        return toPublicConnection(saved ?? connection);
      }

      const { settings, subscriptionActive } = await provider.configureEvents(connection.id, { mode: "pull" });
      const saved = await saveProviderEvents(db, connection.id, { mode: "pull", settings, active: subscriptionActive });
      if (subscriptionActive) {
        await provider.removeEventSubscriptions(connection.id, "push").catch((error: unknown) => {
          logger.warn({ connectionId: connection.id, err: error }, "could not remove the push subscription");
        });
      }
      return toPublicConnection(saved ?? connection);
    },

    async redriveEvents(organizationId: string) {
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      if (!connection) throw new ProviderNotConnectedError();
      if (connection.eventsMode !== "pull" || !connection.settings.eventQueueUrl) {
        throw new EventQueueNotConfiguredError();
      }
      const provider = await providerFromConnection(cipher, connection, { logger });
      await provider.redriveEventMessages();
      return { status: "started" as const };
    },

    async get(organizationId: string) {
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      return connection && toPublicConnection(connection);
    },

    remove: (organizationId: string) => deleteProviderConnection(db, organizationId),

    loadProvider,

    async requireProvider(organizationId: string) {
      const provider = await loadProvider(organizationId);
      if (!provider) throw new ProviderNotConnectedError();
      return provider;
    },
  };
}

export type ProviderConnectionService = ReturnType<typeof createProviderConnectionService>;
