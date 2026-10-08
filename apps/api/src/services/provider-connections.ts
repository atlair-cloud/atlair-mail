import createError from "@fastify/error";
import {
  deleteProviderConnection,
  findProviderConnectionByOrganization,
  upsertProviderConnection,
  type Database,
} from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import type { CredentialsCipher } from "@atlair-mail/core";
import { createProvider, type ProviderConfig, type ProviderSecrets } from "@atlair-mail/providers";

export const ProviderNotConnectedError = createError(
  "ATL_PROVIDER_NOT_CONNECTED",
  "Connect an email provider with PUT /v1/provider first",
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
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

export function createProviderConnectionService(db: Database, cipher: CredentialsCipher) {
  async function loadProvider(organizationId: string) {
    const connection = await findProviderConnectionByOrganization(db, organizationId);
    if (!connection) return null;
    const secrets = JSON.parse(
      await cipher.decrypt(connection.credentialsEncrypted, organizationId),
    ) as ProviderSecrets;
    return createProvider({ type: connection.provider, settings: connection.settings, secrets } as ProviderConfig);
  }

  return {
    async save(organizationId: string, input: ProviderInput) {
      const config = toProviderConfig(input);
      const account = await createProvider(config).verifyAccount();
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
