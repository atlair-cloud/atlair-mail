import fp from "fastify-plugin";
import { createHash } from "node:crypto";
import { findActiveApiKeyByTokenHash, type ActiveApiKey, type Database } from "@atlair-mail/db";

export type ApiKey = ActiveApiKey;

export interface ApiKeyStore {
  /** Resolves the key a request presented, or null if it is unknown or revoked. */
  verify(token: string): Promise<ApiKey | null>;
}

declare module "fastify" {
  interface FastifyInstance {
    apiKeys: ApiKeyStore;
  }
  interface FastifyRequest {
    /** Set by bearer-auth on /v1 routes; null on public routes. */
    apiKey: ApiKey | null;
  }
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function postgresApiKeyStore(db: Database): ApiKeyStore {
  return {
    verify: (token) => findActiveApiKeyByTokenHash(db, hash(token)),
  };
}

export default fp(
  async function apiKeysPlugin(fastify) {
    fastify.decorate("apiKeys", postgresApiKeyStore(fastify.db));
    fastify.decorateRequest("apiKey", null);
  },
  { name: "api-keys", dependencies: ["db"] },
);
