import { and, desc, eq, isNull, lt } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { members, organizations, roles, users, type Member } from "../schema/index.ts";

export interface Membership {
  memberId: string;
  organizationId: string;
  roleName: string;
  permissions: string[];
}

export async function findMembership(db: Executor, organizationId: string, userId: string): Promise<Membership | null> {
  const [membership] = await db
    .select({
      memberId: members.id,
      organizationId: members.organizationId,
      roleName: roles.name,
      permissions: roles.permissions,
    })
    .from(members)
    .innerJoin(roles, eq(roles.id, members.roleId))
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId),
        isNull(organizations.deactivatedAt),
      ),
    )
    .limit(1);
  return membership ?? null;
}

export async function insertMember(
  db: Executor,
  values: { organizationId: string; userId: string; roleId: string; createdBy: string | null },
): Promise<Member> {
  const [member] = await db.insert(members).values(values).returning();
  return member!;
}

const memberColumns = {
  id: members.id,
  userId: members.userId,
  name: users.name,
  email: users.email,
  image: users.image,
  role: roles.name,
  createdAt: members.createdAt,
  createdBy: members.createdBy,
  updatedAt: members.updatedAt,
  updatedBy: members.updatedBy,
};

export interface MemberPage {
  organizationId: string;
  before?: string;
  limit: number;
}

export async function listMembers(db: Executor, page: MemberPage) {
  return db
    .select(memberColumns)
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .innerJoin(roles, eq(roles.id, members.roleId))
    .where(
      and(
        eq(members.organizationId, page.organizationId),
        page.before === undefined ? undefined : lt(members.id, page.before),
      ),
    )
    .orderBy(desc(members.id))
    .limit(page.limit);
}

export async function findMember(db: Executor, organizationId: string, memberId: string) {
  const [member] = await db
    .select(memberColumns)
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .innerJoin(roles, eq(roles.id, members.roleId))
    .where(and(eq(members.organizationId, organizationId), eq(members.id, memberId)))
    .limit(1);
  return member ?? null;
}

export async function updateMemberRole(db: Executor, memberId: string, roleId: string, updatedBy: string) {
  await db.update(members).set({ roleId, updatedBy }).where(eq(members.id, memberId));
}

export async function deleteMember(db: Executor, memberId: string) {
  await db.delete(members).where(eq(members.id, memberId));
}

export async function hasMemberWithRole(db: Executor, organizationId: string, roleName: string) {
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(roles, eq(roles.id, members.roleId))
    .where(and(eq(members.organizationId, organizationId), eq(roles.name, roleName)))
    .limit(1);
  return member !== undefined;
}
