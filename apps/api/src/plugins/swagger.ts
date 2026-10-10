import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";
import { Type } from "typebox";
import { apiVersionHeader, defaultApiVersion } from "../lib/api-version.ts";

const versionHeaders = Type.Object({
  [apiVersionHeader]: Type.Optional(
    Type.String({ default: defaultApiVersion, description: `API version. Defaults to ${defaultApiVersion}.` }),
  ),
});

export default fp(
  async function swaggerPlugin(fastify) {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: "atlair-mail API",
          version: "0.1.0",
        },
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer" },
            panelSession: { type: "apiKey", in: "cookie", name: "atlair-mail.session_token" },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      transform: ({ schema, url }) => {
        if (!url.startsWith("/service/")) return { schema, url };
        return { schema: { ...schema, headers: versionHeaders }, url };
      },
    });

    await fastify.register(apiReference, { routePrefix: "/docs" });
  },
  { name: "swagger" },
);
