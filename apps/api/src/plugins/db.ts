import fp from "fastify-plugin";
import { createDb, type Db } from "@atlair-mail/db";

declare module "fastify" {
  interface FastifyInstance {
    db: Db["db"];
  }
}

export default fp(
  async function dbPlugin(fastify) {
    const { db, close } = createDb(fastify.config.DATABASE_URL);
    fastify.decorate("db", db);
    fastify.addHook("onClose", async () => {
      await close();
    });
  },
  { name: "db", dependencies: ["config"] },
);
