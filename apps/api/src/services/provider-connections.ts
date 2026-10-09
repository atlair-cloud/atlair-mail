import createError from "@fastify/error";
import {
  deleteProviderConnection,
  findProviderConnectionByOrganization,
  updateProviderSettings,
  upsertProviderConnection,
  type Database,
} from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import {
  loadProvider as loadStoredProvider,
  providerFromConnection,
  type CredentialsCipher,
} from "@atlair-mail/core";
import {
  createProvider,
  ProviderError,
  type EmailProvider,
  type ProviderConfig,
  type ProviderLogger,
} from "@atlair-mail/providers";

export const ProviderNotConnectedError = createError(
  "ATL_PROVIDER_NOT_CONNECTED",
  "Connect an email provider with PUT /v1/provider first",
  409,
);

export const PublicUrlNotSetError = createError(
  "ATL_PUBLIC_URL_NOT_SET",
  "Set PUBLIC_URL to this server's public HTTPS address so the provider can deliver events",
  409,
);

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

const toPublicConnection = (connection: ProviderConnection) => ({
  id: connection.id,
  type: connection.provider,
  ...connection.settings,
  eventsEnabled: Boolean(connection.settings.eventTopicArn),
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

export const eventEndpoint = (publicUrl: string, connectionId: string) =>
  `${publicUrl.replace(/\/+$/, "")}/webhooks/provider-events/${connectionId}`;

export function createProviderConnectionService(
  db: Database,
  cipher: CredentialsCipher,
  logger: ProviderLogger,
  publicUrl: string,
) {
  const loadProvider = (organizationId: string) => loadStoredProvider(db, cipher, organizationId, { logger });

  async function configureEvents(connection: ProviderConnection, provider: EmailProvider) {
    if (!publicUrl) throw new PublicUrlNotSetError();
    const settings = await provider.configureEvents(eventEndpoint(publicUrl, connection.id));
    return (await updateProviderSettings(db, connection.id, settings)) ?? connection;
  }

  async function configureEventsIfPossible(connection: ProviderConnection, provider: EmailProvider) {
    try {
      return { connection: await configureEvents(connection, provider), eventsError: null };
    } catch (error) {
      if (error instanceof ProviderError) return { connection, eventsError: error.summary };
      if (error instanceof PublicUrlNotSetError) return { connection, eventsError: error.code };
      throw error;
    }
  }

  return {
    async save(organizationId: string, input: ProviderInput) {
      const config = toProviderConfig(input);
      const provider = createProvider(config, { logger });
      const account = await provider.verifyAccount();
      const { ciphertext, keyVersion } = await cipher.encrypt(JSON.stringify(config.secrets), organizationId);
      const connection = await upsertProviderConnection(db, {
        organizationId,
        provider: config.type,
        settings: config.settings,
        credentialsEncrypted: ciphertext,
        encryptionKeyVersion: keyVersion,
      });
      const configured = await configureEventsIfPossible(connection, provider);
      return { ...toPublicConnection(configured.connection), account, eventsError: configured.eventsError };
    },

    async setUpEvents(organizationId: string) {
      const connection = await findProviderConnectionByOrganization(db, organizationId);
      if (!connection) throw new ProviderNotConnectedError();
      const provider = await providerFromConnection(cipher, connection, { logger });
      return toPublicConnection(await configureEvents(connection, provider));
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
