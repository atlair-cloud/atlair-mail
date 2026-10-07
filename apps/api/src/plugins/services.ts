import fp from "fastify-plugin";
import { createOrganizationService, type OrganizationService } from "../services/organizations.ts";

export interface Services {
  organizations: OrganizationService;
}

declare module "fastify" {
  interface FastifyInstance {
    services: Services;
  }
}

export default fp(
  async function servicesPlugin(fastify) {
    fastify.decorate("services", {
      organizations: createOrganizationService(fastify.db),
    });
  },
  { name: "services", dependencies: ["db"] },
);
