import { findProviderConnectionByOrganization, type Executor } from "@atlair-mail/db";
import {
  createProvider,
  type CreateProviderOptions,
  type EmailProvider,
  type ProviderConfig,
  type ProviderSecrets,
} from "@atlair-mail/providers";
import type { CredentialsCipher } from "./credentials-cipher.ts";

export async function loadProvider(
  db: Executor,
  cipher: CredentialsCipher,
  organizationId: string,
  options: CreateProviderOptions = {},
): Promise<EmailProvider | null> {
  const connection = await findProviderConnectionByOrganization(db, organizationId);
  if (!connection) return null;
  const secrets = JSON.parse(await cipher.decrypt(connection.credentialsEncrypted, organizationId)) as ProviderSecrets;
  return createProvider({ type: connection.provider, settings: connection.settings, secrets } as ProviderConfig, options);
}
