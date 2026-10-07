import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";

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
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await fastify.register(apiReference, { routePrefix: "/docs" });
  },
  { name: "swagger" },
);
