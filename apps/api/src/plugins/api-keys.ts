import fp from "fastify-plugin";
import {
  findActiveApiKeyByTokenHash,
  touchApiKeyLastUsed,
  type ActiveApiKey,
  type ApiKeyPermission,
  type Database,
} from "@atlair-mail/db";
import { hashApiKeyToken, tokensMatch } from "../lib/api-key-tokens.ts";

export type ApiKey = ActiveApiKey;

export type RouteAccess = "organization" | "root";

export interface ApiKeyStore {
  verify(token: string): Promise<ApiKey | null>;
  isRootKey(token: string): boolean;
}

declare module "fastify" {
  interface FastifyInstance {
    apiKeys: ApiKeyStore;
  }
  interface FastifyRequest {
    apiKey: ApiKey | null;
    isRootKey: boolean;
  }
  interface FastifyContextConfig {
    access?: RouteAccess;
    permission?: ApiKeyPermission;
  }
}

function postgresApiKeyStore(db: Database, rootApiKey: string): ApiKeyStore {
  return {
    async verify(token) {
      const key = await findActiveApiKeyByTokenHash(db, hashApiKeyToken(token));
      if (key) await touchApiKeyLastUsed(db, key.id);
      return key;
    },
    isRootKey: (token) => rootApiKey !== "" && tokensMatch(token, rootApiKey),
  };
}

export default fp(
  async function apiKeysPlugin(fastify) {
    fastify.decorate("apiKeys", postgresApiKeyStore(fastify.db, fastify.config.ROOT_API_KEY));
    fastify.decorateRequest("apiKey", null);
    fastify.decorateRequest("isRootKey", false);
  },
  { name: "api-keys", dependencies: ["config", "db"] },
);
