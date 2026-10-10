import { randomBytes } from "node:crypto";
import createError from "@fastify/error";
import {
  deactivateOrganization,
  findOrganizationById,
  findOrganizationBySlug,
  hasPgErrorCode,
  insertAuditLog,
  insertMember,
  insertOrganization,
  listOrganizationsForUser,
  pgErrorCodes,
  seedOrganizationRoles,
  updateOrganization,
  type Database,
  type Executor,
} from "@atlair-mail/db";
import { createApiKey } from "./api-keys.ts";

export const SlugTakenError = createError("ATL_SLUG_TAKEN", "Slug %s is already taken", 409);

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/g, "");
  return base === "" ? "org" : base;
}

const generatedSlug = (name: string) => `${slugify(name)}-${randomBytes(4).toString("hex")}`;

async function withSlugCheck<T>(slug: string, run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (hasPgErrorCode(error, pgErrorCodes.uniqueViolation)) throw new SlugTakenError(slug);
    throw error;
  }
}

async function insertWithRoles(tx: Executor, input: { name: string; slug: string; createdBy: string | null }) {
  const organization = await insertOrganization(tx, input);
  const roles = await seedOrganizationRoles(tx, organization.id, input.createdBy);
  await insertAuditLog(tx, {
    organizationId: organization.id,
    actorUserId: input.createdBy,
    action: "organization.created",
    entityType: "organization",
    entityId: organization.id,
  });
  return { organization, roles };
}

export function createOrganizationService(db: Database) {
  return {
    create: (input: { name: string; slug?: string }) => {
      const slug = input.slug ?? generatedSlug(input.name);
      return withSlugCheck(slug, () =>
        db.transaction(async (tx) => {
          const { organization } = await insertWithRoles(tx, { name: input.name, slug, createdBy: null });
          const apiKey = await createApiKey(tx, organization.id, { name: "Default" }, null);
          return { ...organization, apiKey };
        }),
      );
    },

    createForUser: (input: { name: string; slug?: string; userId: string }) => {
      const slug = input.slug ?? generatedSlug(input.name);
      return withSlugCheck(slug, () =>
        db.transaction(async (tx) => {
          const { organization, roles } = await insertWithRoles(tx, {
            name: input.name,
            slug,
            createdBy: input.userId,
          });
          const owner = roles.find((role) => role.name === "owner")!;
          await insertMember(tx, {
            organizationId: organization.id,
            userId: input.userId,
            roleId: owner.id,
            createdBy: input.userId,
          });
          return { ...organization, role: owner.name };
        }),
      );
    },

    get: (id: string) => findOrganizationById(db, id),

    listForUser: (userId: string, page: { before?: string; limit: number }) =>
      listOrganizationsForUser(db, { userId, ...page }),

    isSlugAvailable: async (slug: string) => (await findOrganizationBySlug(db, slug)) === null,

    update: (input: { organizationId: string; actorUserId: string; name?: string; slug?: string }) =>
      withSlugCheck(input.slug ?? "", () =>
        db.transaction(async (tx) => {
          const before = await findOrganizationById(tx, input.organizationId);
          if (!before) return null;
          const updated = await updateOrganization(tx, input.organizationId, {
            name: input.name,
            slug: input.slug,
            updatedBy: input.actorUserId,
          });
          await insertAuditLog(tx, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            action: "organization.updated",
            entityType: "organization",
            entityId: input.organizationId,
            changes: {
              before: { name: before.name, slug: before.slug },
              after: { name: updated!.name, slug: updated!.slug },
            },
          });
          return updated;
        }),
      ),

    deactivate: (input: { organizationId: string; actorUserId: string }) =>
      db.transaction(async (tx) => {
        await deactivateOrganization(tx, input.organizationId, input.actorUserId);
        await insertAuditLog(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "organization.deactivated",
          entityType: "organization",
          entityId: input.organizationId,
        });
      }),
  };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
