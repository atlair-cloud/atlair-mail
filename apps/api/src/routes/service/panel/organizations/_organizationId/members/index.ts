import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../../../lib/schemas.ts";
import { MemberSchema, PageQuerySchema, RoleNameSchema } from "../../../../../../schemas/panel.ts";

const tags = ["Panel"];
const params = Type.Object({ organizationId: Uuid() });
const memberParams = Type.Object({ organizationId: Uuid(), memberId: Uuid() });

const memberRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      config: { permissions: ["member:view"] },
      schema: {
        summary: "List members",
        description: "Newest first; pass the last id as before to get the next page.",
        tags,
        security: [{ panelSession: [] }],
        params,
        querystring: PageQuerySchema,
        response: { 200: Type.Object({ data: Type.Array(MemberSchema) }) },
      },
    },
    async (request) => ({
      data: await fastify.services.members.list(request.params.organizationId, {
        before: request.query.before,
        limit: request.query.limit ?? 50,
      }),
    }),
  );

  fastify.post(
    "/",
    {
      config: { permissions: ["member:invite"] },
      schema: {
        summary: "Add a member",
        description: "The person must already have an account.",
        tags,
        security: [{ panelSession: [] }],
        params,
        body: Type.Object({ email: Type.String({ format: "email", maxLength: 254 }), role: RoleNameSchema }),
        response: { 201: MemberSchema },
      },
    },
    async (request, reply) => {
      const member = await fastify.services.members.add({
        organizationId: request.params.organizationId,
        email: request.body.email,
        role: request.body.role,
        actorUserId: request.user!.id,
      });
      return reply.code(201).send(member);
    },
  );

  fastify.patch(
    "/:memberId",
    {
      config: { permissions: ["member:update_role"] },
      schema: {
        summary: "Change a member's role",
        tags,
        security: [{ panelSession: [] }],
        params: memberParams,
        body: Type.Object({ role: RoleNameSchema }),
        response: { 200: MemberSchema },
      },
    },
    async (request) =>
      fastify.services.members.updateRole({
        organizationId: request.params.organizationId,
        memberId: request.params.memberId,
        role: request.body.role,
        actorUserId: request.user!.id,
      }),
  );

  fastify.delete(
    "/:memberId",
    {
      config: { permissions: ["member:remove"] },
      schema: {
        summary: "Remove a member",
        tags,
        security: [{ panelSession: [] }],
        params: memberParams,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      await fastify.services.members.remove({
        organizationId: request.params.organizationId,
        memberId: request.params.memberId,
        actorUserId: request.user!.id,
      });
      return reply.code(204).send(null);
    },
  );
};

export default memberRoutes;
