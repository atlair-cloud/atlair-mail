import type { FastifyPluginAsync } from "fastify";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const organizationHooks: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRoute", (route) => {
    if (!route.config?.permissions?.length) {
      throw new Error(`${route.method} ${route.url} must declare config.permissions`);
    }
  });

  fastify.addHook("onRequest", async (request) => {
    const { organizationId } = request.params as { organizationId: string };
    const membership = uuidPattern.test(organizationId)
      ? await fastify.services.members.membership(organizationId, request.user!.id)
      : null;
    if (!membership) throw fastify.httpErrors.notFound("Organization not found");

    const required = request.routeOptions.config.permissions ?? [];
    if (!required.every((permission) => membership.permissions.includes(permission))) {
      throw fastify.httpErrors.forbidden("You don't have permission to do this");
    }
    request.membership = membership;
  });
};

export default organizationHooks;
