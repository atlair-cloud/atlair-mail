import {
  deleteSesConnection,
  findSesConnectionByOrganization,
  upsertSesConnection,
  type Database,
} from "@atlair-mail/db";
import type { CredentialsCipher } from "@atlair-mail/core";
import { fetchSesAccount } from "../lib/ses-account.ts";
import type { SesCredentials } from "../lib/ses-client.ts";

export function createSesConnectionService(db: Database, cipher: CredentialsCipher) {
  return {
    async save(organizationId: string, input: SesCredentials) {
      const account = await fetchSesAccount(input);
      const { ciphertext, keyVersion } = await cipher.encrypt(input.secretAccessKey, organizationId);
      const connection = await upsertSesConnection(db, {
        organizationId,
        region: input.region,
        accessKeyId: input.accessKeyId,
        secretAccessKeyEncrypted: ciphertext,
        encryptionKeyVersion: keyVersion,
      });
      return { ...connection, account };
    },

    get: (organizationId: string) => findSesConnectionByOrganization(db, organizationId),

    remove: (organizationId: string) => deleteSesConnection(db, organizationId),

    async loadCredentials(organizationId: string): Promise<SesCredentials | null> {
      const connection = await findSesConnectionByOrganization(db, organizationId);
      if (!connection) return null;
      return {
        region: connection.region,
        accessKeyId: connection.accessKeyId,
        secretAccessKey: await cipher.decrypt(connection.secretAccessKeyEncrypted, organizationId),
      };
    },
  };
}

export type SesConnectionService = ReturnType<typeof createSesConnectionService>;
