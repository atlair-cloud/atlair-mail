import type { FastifyContextConfig, FastifyRequest } from "fastify";
import { Type, type TObject, type TProperties } from "typebox";
import type { Actor, ApiKeyPermission, Permission } from "@atlair-mail/db";
import { Uuid } from "../lib/schemas.ts";

export interface ResourceScope {
  organizationId(request: FastifyRequest): string;
  apiKeyId(request: FastifyRequest): string | null;
  actor(request: FastifyRequest): Actor;
  config(permissions: Permission[], keyPermission?: ApiKeyPermission): FastifyContextConfig;
  params<P extends TProperties = {}>(properties?: P): TObject<P>;
  security: { security?: Record<string, string[]>[] };
}

export const webScope: ResourceScope = {
  organizationId: (request) => request.apiKey!.organizationId,
  apiKeyId: (request) => request.apiKey!.id,
  actor: (request) => ({ userId: null, apiKeyId: request.apiKey!.id }),
  config: (_permissions, keyPermission) => (keyPermission ? { permission: keyPermission } : {}),
  params: <P extends TProperties = {}>(properties?: P) => Type.Object((properties ?? {}) as P),
  security: {},
};

export const panelScope: ResourceScope = {
  organizationId: (request) => request.membership!.organizationId,
  apiKeyId: () => null,
  actor: (request) => ({ userId: request.user!.id, apiKeyId: null }),
  config: (permissions) => ({ permissions }),
  params: <P extends TProperties = {}>(properties?: P) =>
    Type.Object({ organizationId: Uuid(), ...(properties ?? {}) }) as unknown as TObject<P>,
  security: { security: [{ panelSession: [] }] },
};
