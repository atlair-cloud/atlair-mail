import fp from "fastify-plugin";
import { createHash } from "node:crypto";

export interface ApiKey {
  id: string;
}

export interface ApiKeyStore {
  /** Resolves the key a request presented, or null if it isn't valid. */
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

// Temporary: keys come from the API_KEYS env var. Swap for a Postgres-backed store
// once packages/db exists; callers only depend on ApiKeyStore.
function envApiKeyStore(rawKeys: string): ApiKeyStore {
  const byHash = new Map<string, ApiKey>();
  for (const token of rawKeys.split(",").map((k) => k.trim()).filter(Boolean)) {
    const digest = hash(token);
    byHash.set(digest, { id: `key_${digest.slice(0, 12)}` });
  }

  return {
    async verify(token) {
      return byHash.get(hash(token)) ?? null;
    },
  };
}

export default fp(
  async function apiKeysPlugin(fastify) {
    fastify.decorate("apiKeys", envApiKeyStore(fastify.config.API_KEYS));
    fastify.decorateRequest("apiKey", null);
  },
  { name: "api-keys", dependencies: ["config"] },
);
