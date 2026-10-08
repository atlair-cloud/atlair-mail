import fp from "fastify-plugin";
import { createCredentialsCipher, type CredentialsCipher } from "@atlair-mail/core";

declare module "fastify" {
  interface FastifyInstance {
    credentialsCipher: CredentialsCipher;
  }
}

export default fp(
  async function credentialsCipherPlugin(fastify) {
    fastify.decorate("credentialsCipher", createCredentialsCipher(fastify.config.CREDENTIALS_ENCRYPTION_KEYS));
  },
  { name: "credentials-cipher", dependencies: ["config"] },
);
