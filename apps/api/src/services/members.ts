import createError from "@fastify/error";
import {
  deleteMember,
  findMember,
  findMembership,
  findRoleByName,
  findUserIdByEmail,
  hasMemberWithRole,
  hasPgErrorCode,
  insertAuditLog,
  insertMember,
  listMembers,
  pgErrorCodes,
  updateMemberRole,
  type Database,
} from "@atlair-mail/db";

export const UserNotFoundError = createError(
  "ATL_USER_NOT_FOUND",
  "No account uses that email. Ask them to sign up first",
  404,
);
export const RoleNotFoundError = createError("ATL_ROLE_NOT_FOUND", "Role %s does not exist", 400);
export const AlreadyMemberError = createError("ATL_ALREADY_MEMBER", "That user is already a member", 409);
export const MemberNotFoundError = createError("ATL_MEMBER_NOT_FOUND", "Member not found", 404);
export const OwnerProtectedError = createError(
  "ATL_OWNER_PROTECTED",
  "The owner's role can't be changed and the owner can't be removed",
  409,
);
export const OwnerGrantError = createError("ATL_OWNER_GRANT", "The owner role can't be granted", 400);

export interface AddMemberInput {
  organizationId: string;
  email: string;
  role: string;
  actorUserId: string | null;
  allowFirstOwner?: boolean;
}

export function createMemberService(db: Database) {
  return {
    membership: (organizationId: string, userId: string) => findMembership(db, organizationId, userId),

    list: (organizationId: string, page: { before?: string; limit: number }) =>
      listMembers(db, { organizationId, ...page }),

    add: async (input: AddMemberInput) => {
      try {
        return await db.transaction(async (tx) => {
          if (input.role === "owner") {
            if (!input.allowFirstOwner || (await hasMemberWithRole(tx, input.organizationId, "owner"))) {
              throw new OwnerGrantError();
            }
          }
          const userId = await findUserIdByEmail(tx, input.email);
          if (!userId) throw new UserNotFoundError();
          const role = await findRoleByName(tx, input.organizationId, input.role);
          if (!role) throw new RoleNotFoundError(input.role);
          if (await findMembership(tx, input.organizationId, userId)) throw new AlreadyMemberError();

          const member = await insertMember(tx, {
            organizationId: input.organizationId,
            userId,
            roleId: role.id,
            createdBy: input.actorUserId,
          });
          await insertAuditLog(tx, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            action: "member.added",
            entityType: "member",
            entityId: member.id,
            changes: { userId, role: role.name },
          });
          return (await findMember(tx, input.organizationId, member.id))!;
        });
      } catch (error) {
        if (hasPgErrorCode(error, pgErrorCodes.uniqueViolation)) throw new AlreadyMemberError();
        throw error;
      }
    },

    updateRole: (input: { organizationId: string; memberId: string; role: string; actorUserId: string }) =>
      db.transaction(async (tx) => {
        const existing = await findMember(tx, input.organizationId, input.memberId);
        if (!existing) throw new MemberNotFoundError();
        if (existing.role === "owner") throw new OwnerProtectedError();
        if (input.role === "owner") throw new OwnerGrantError();
        const role = await findRoleByName(tx, input.organizationId, input.role);
        if (!role) throw new RoleNotFoundError(input.role);

        await updateMemberRole(tx, input.memberId, role.id, input.actorUserId);
        await insertAuditLog(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "member.role_updated",
          entityType: "member",
          entityId: input.memberId,
          changes: { before: { role: existing.role }, after: { role: role.name } },
        });
        return (await findMember(tx, input.organizationId, input.memberId))!;
      }),

    remove: (input: { organizationId: string; memberId: string; actorUserId: string }) =>
      db.transaction(async (tx) => {
        const existing = await findMember(tx, input.organizationId, input.memberId);
        if (!existing) throw new MemberNotFoundError();
        if (existing.role === "owner") throw new OwnerProtectedError();

        await deleteMember(tx, input.memberId);
        await insertAuditLog(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "member.removed",
          entityType: "member",
          entityId: input.memberId,
          changes: { userId: existing.userId, role: existing.role },
        });
      }),
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
