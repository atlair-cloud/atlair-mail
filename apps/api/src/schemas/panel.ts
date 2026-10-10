import { Type } from "typebox";
import { organizationSlugPattern, roleNames } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";

export const maxPanelPageSize = 100;

export const PageQuerySchema = Type.Object({
  before: Type.Optional(Type.String({ format: "uuid", description: "Return items older than this id, the last id of the previous page." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: maxPanelPageSize, default: 50 })),
});

export const OrganizationSlugSchema = Type.String({ pattern: organizationSlugPattern, minLength: 1, maxLength: 50 });

export const OrganizationNameSchema = Type.String({ minLength: 1, maxLength: 100 });

export const RoleNameSchema = Type.Enum(roleNames);

export const OrganizationSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  slug: Type.String(),
  createdAt: DateTime(),
});

export const UserOrganizationSchema = Type.Object({
  ...OrganizationSchema.properties,
  role: Type.String(),
});

export const UserSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  email: Type.String(),
  emailVerified: Type.Boolean(),
  image: Type.Union([Type.String(), Type.Null()]),
  createdAt: DateTime(),
});

export const MemberSchema = Type.Object({
  id: Uuid(),
  userId: Uuid(),
  name: Type.String(),
  email: Type.String(),
  image: Type.Union([Type.String(), Type.Null()]),
  role: Type.String(),
  createdAt: DateTime(),
});

export const RoleSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  permissions: Type.Array(Type.String()),
});

export const AuditLogSchema = Type.Object({
  id: Uuid(),
  action: Type.String(),
  entityType: Type.String(),
  entityId: Type.String(),
  changes: Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
  actor: Type.Union([Type.Object({ id: Uuid(), name: Type.String(), email: Type.String() }), Type.Null()]),
  createdAt: DateTime(),
});
