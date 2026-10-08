import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { encryptionKeyVersion, id, timestamps } from "./_columns.ts";
import { organizationId } from "./organizations.ts";

export const sesConnections = pgTable(
  "ses_connections",
  {
    id: id(),
    organizationId: organizationId(),
    region: text("region").notNull(),
    accessKeyId: text("access_key_id").notNull(),
    secretAccessKeyEncrypted: text("secret_access_key_encrypted").notNull(),
    encryptionKeyVersion: encryptionKeyVersion(),
    configurationSet: text("configuration_set"),
    ...timestamps,
  },
  (t) => [uniqueIndex("ses_connections_organization_id_unique").on(t.organizationId)],
);

export type SesConnection = typeof sesConnections.$inferSelect;
export type NewSesConnection = typeof sesConnections.$inferInsert;
