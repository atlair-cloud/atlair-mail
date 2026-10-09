import { findProviderConnectionByOrganization, type Executor } from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import {
  createProvider,
  type CreateProviderOptions,
  type EmailProvider,
  type ProviderConfig,
  type ProviderSecrets,
} from "@atlair-mail/providers";
import type { CredentialsCipher } from "./credentials-cipher.ts";

export async function providerFromConnection(
  cipher: CredentialsCipher,
  connection: ProviderConnection,
  options: CreateProviderOptions = {},
): Promise<EmailProvider> {
  const secrets = JSON.parse(
    await cipher.decrypt(connection.credentialsEncrypted, connection.organizationId),
  ) as ProviderSecrets;
  return createProvider({ type: connection.provider, settings: connection.settings, secrets } as ProviderConfig, options);
}

export async function loadProvider(
  db: Executor,
  cipher: CredentialsCipher,
  organizationId: string,
  options: CreateProviderOptions = {},
): Promise<EmailProvider | null> {
  const connection = await findProviderConnectionByOrganization(db, organizationId);
  return connection && providerFromConnection(cipher, connection, options);
}
