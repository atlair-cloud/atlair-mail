import { uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { apiKeys } from "./api-keys.ts";
import { userId } from "./auth.ts";

const apiKeyId = (name: string) =>
  uuid(name).references((): AnyPgColumn => apiKeys.id, { onDelete: "set null" });

export const createdByColumns = () => ({
  createdBy: userId("created_by"),
  createdByApiKeyId: apiKeyId("created_by_api_key_id"),
});

export const updatedByColumns = () => ({
  updatedBy: userId("updated_by"),
  updatedByApiKeyId: apiKeyId("updated_by_api_key_id"),
});

export const authorship = () => ({ ...createdByColumns(), ...updatedByColumns() });
