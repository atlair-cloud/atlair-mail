import { and, desc, eq, isNull, lt } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { members, organizations, roles, type NewOrganization } from "../schema/index.ts";

export async function insertOrganization(db: Executor, values: NewOrganization) {
  const [organization] = await db.insert(organizations).values(values).returning();
  return organization!;
}

export async function findOrganizationById(db: Executor, id: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  return organization ?? null;
}

export async function findOrganizationBySlug(db: Executor, slug: string) {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return organization ?? null;
}

export interface UserOrganizationPage {
  userId: string;
  before?: string;
  limit: number;
}

export async function listOrganizationsForUser(db: Executor, page: UserOrganizationPage) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: roles.name,
      createdAt: organizations.createdAt,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .innerJoin(roles, eq(roles.id, members.roleId))
    .where(
      and(
        eq(members.userId, page.userId),
        isNull(organizations.deactivatedAt),
        page.before === undefined ? undefined : lt(organizations.id, page.before),
      ),
    )
    .orderBy(desc(organizations.id))
    .limit(page.limit);
}

export async function updateOrganization(
  db: Executor,
  id: string,
  values: { name?: string; slug?: string; updatedBy: string },
) {
  const [organization] = await db.update(organizations).set(values).where(eq(organizations.id, id)).returning();
  return organization ?? null;
}

export async function deactivateOrganization(db: Executor, id: string, updatedBy: string) {
  await db
    .update(organizations)
    .set({ deactivatedAt: new Date(), updatedBy })
    .where(and(eq(organizations.id, id), isNull(organizations.deactivatedAt)));
}
