import { Type } from "typebox";
import { apiKeyPermissions } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";

export const ApiKeyPermissionSchema = Type.Enum(apiKeyPermissions);

export const ApiKeySchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  permission: ApiKeyPermissionSchema,
  tokenPrefix: Type.String(),
  lastUsedAt: Type.Union([DateTime(), Type.Null()]),
  revokedAt: Type.Union([DateTime(), Type.Null()]),
  createdAt: DateTime(),
});

export const CreatedApiKeySchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  permission: ApiKeyPermissionSchema,
  token: Type.String({ description: "Shown only once. Store it now; it cannot be retrieved later." }),
  tokenPrefix: Type.String(),
  createdAt: DateTime(),
});

export const CurrentApiKeySchema = Type.Object({
  id: Uuid(),
  organizationId: Uuid(),
  permission: ApiKeyPermissionSchema,
});
