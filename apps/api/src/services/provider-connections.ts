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
import { createProvider, type ProviderConfig, type ProviderLogger } from "@atlair-mail/providers";

export const ProviderNotConnectedError = createError(
  "ATL_PROVIDER_NOT_CONNECTED",
  "Connect an email provider with PUT /v1/provider first",
  409,
);

export const InvalidEventsUrlError = createError(
  "ATL_INVALID_EVENTS_URL",
  "url must be this server's public https address on a registered domain, without credentials, query or fragment",
  400,
);

export type EventsStatus = "disabled" | "pending_confirmation" | "confirmed";

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
  if (!connection.eventsUrl) return "disabled";
  return connection.eventsConfirmedAt ? "confirmed" : "pending_confirmation";
};

const toPublicConnection = (connection: ProviderConnection) => ({
  id: connection.id,
  type: connection.provider,
  ...connection.settings,
  events: {
    url: connection.eventsUrl,
    status: eventsStatus(connection),
    confirmedAt: connection.eventsConfirmedAt,
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

    async setUpEvents(organizationId: string, url: string) {
      const eventsUrl = normalizePublicUrl(url);
      if (!eventsUrl) throw new InvalidEventsUrlError();
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      if (!connection) throw new ProviderNotConnectedError();
      const provider = await providerFromConnection(cipher, connection, { logger });
      const { settings } = await provider.configureEvents(connection.id, {
        mode: "push",
        endpointUrl: eventEndpoint(eventsUrl, connection.id),
      });
      const saved = await saveProviderEvents(db, connection.id, { settings, eventsUrl });
      return toPublicConnection(saved ?? connection);
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
