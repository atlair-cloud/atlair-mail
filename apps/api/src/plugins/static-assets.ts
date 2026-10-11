import fp from "fastify-plugin";
import staticFiles from "@fastify/static";
import { join } from "node:path";

export const assetsPrefix = "/assets/";

export default fp(
  async function staticAssetsPlugin(fastify) {
    await fastify.register(staticFiles, {
      root: join(import.meta.dirname, "../../assets"),
      prefix: `${fastify.config.BASE_PATH}${assetsPrefix}`,
      decorateReply: false,
      index: false,
      list: false,
      allowedPath: (path) => path.endsWith(".png"),
      maxAge: "7d",
      setHeaders: (reply) => {
        reply.header("Cross-Origin-Resource-Policy", "cross-origin");
      },
      schemaHide: true,
    });
  },
  { name: "static-assets" },
);
