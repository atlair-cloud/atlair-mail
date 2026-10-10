import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { schema } from "@atlair-mail/db";
import organizationHooks from "../src/routes/service/panel/organizations/_organizationId/autohooks.ts";
import {
  addPanelMember,
  auth,
  buildPanelTestApp,
  createPanelOrganization,
  deleteOrganizationAfterTest,
  hasDatabase,
  PANEL_ORIGIN,
  signUp,
  TEST_ROOT_KEY,
} from "./helpers.ts";

const organizationUrl = (id: string, path = "") => `/service/panel/organizations/${id}${path}`;

describe("panel organizations", { skip: !hasDatabase }, () => {
  it("creates an organization with the creator as owner, seeded roles and an audit entry", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);

    const organization = await createPanelOrganization(app, owner, "Acme Mail");
    const roles = await app.inject({ method: "GET", url: organizationUrl(organization.id, "/roles"), headers: owner.headers });
    const audit = await app.inject({ method: "GET", url: organizationUrl(organization.id, "/audit-log"), headers: owner.headers });

    assert.equal(organization.role, "owner");
    assert.match(organization.slug, /^acme-mail-[0-9a-f]{8}$/);
    assert.deepEqual(roles.json().data.map((role: { name: string }) => role.name).sort(), ["admin", "member", "owner"]);
    assert.deepEqual(audit.json().data.map((entry: { action: string }) => entry.action), ["organization.created"]);
  });

  it("lists only the user's organizations, newest first, with their role", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const other = await signUp(app);
    const first = await createPanelOrganization(app, owner, "First");
    const second = await createPanelOrganization(app, owner, "Second");
    await createPanelOrganization(app, other, "Not mine");

    const page = await app.inject({ method: "GET", url: "/service/panel/organizations", headers: owner.headers });
    const next = await app.inject({
      method: "GET",
      url: `/service/panel/organizations?limit=1&before=${second.id}`,
      headers: owner.headers,
    });

    assert.deepEqual(page.json().data.map((org: { id: string }) => org.id), [second.id, first.id]);
    assert.deepEqual(page.json().data.map((org: { role: string }) => org.role), ["owner", "owner"]);
    assert.deepEqual(next.json().data.map((org: { id: string }) => org.id), [first.id]);
  });

  it("uses a given slug, reports availability, and rejects a taken one", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const slug = `acme-${Date.now()}`;

    const before = await app.inject({ method: "GET", url: `/service/panel/organizations/slug-availability?slug=${slug}`, headers: owner.headers });
    const created = await app.inject({ method: "POST", url: "/service/panel/organizations", headers: owner.headers, payload: { name: "Acme", slug } });
    deleteOrganizationAfterTest(app, created.json().id);
    const after = await app.inject({ method: "GET", url: `/service/panel/organizations/slug-availability?slug=${slug}`, headers: owner.headers });
    const taken = await app.inject({ method: "POST", url: "/service/panel/organizations", headers: owner.headers, payload: { name: "Acme", slug } });
    const invalid = await app.inject({ method: "POST", url: "/service/panel/organizations", headers: owner.headers, payload: { name: "Acme", slug: "Not A Slug" } });

    assert.equal(before.json().available, true);
    assert.equal(created.json().slug, slug);
    assert.equal(after.json().available, false);
    assert.equal(taken.statusCode, 409);
    assert.equal(invalid.statusCode, 400);
  });

  it("updates the organization and records before and after", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const organization = await createPanelOrganization(app, owner, "Old name");

    const res = await app.inject({
      method: "PATCH",
      url: organizationUrl(organization.id),
      headers: owner.headers,
      payload: { name: "New name" },
    });
    const [entry] = (
      await app.inject({ method: "GET", url: organizationUrl(organization.id, "/audit-log"), headers: owner.headers })
    ).json().data;

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().name, "New name");
    assert.equal(entry.action, "organization.updated");
    assert.deepEqual(entry.changes.before.name, "Old name");
    assert.equal(entry.actor.id, owner.id);
  });

  it("hides another organization behind 404 on every route", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const outsider = await signUp(app);
    const organization = await createPanelOrganization(app, owner);
    const memberId = uuidv7();

    const requests = [
      { method: "GET", url: organizationUrl(organization.id) },
      { method: "PATCH", url: organizationUrl(organization.id), payload: { name: "Mine now" } },
      { method: "DELETE", url: organizationUrl(organization.id) },
      { method: "GET", url: organizationUrl(organization.id, "/members") },
      { method: "POST", url: organizationUrl(organization.id, "/members"), payload: { email: outsider.email, role: "admin" } },
      { method: "PATCH", url: organizationUrl(organization.id, `/members/${memberId}`), payload: { role: "admin" } },
      { method: "DELETE", url: organizationUrl(organization.id, `/members/${memberId}`) },
      { method: "GET", url: organizationUrl(organization.id, "/roles") },
      { method: "GET", url: organizationUrl(organization.id, "/audit-log") },
      { method: "GET", url: organizationUrl("not-a-uuid") },
    ] as const;

    for (const request of requests) {
      const res = await app.inject({ ...request, headers: outsider.headers });
      assert.equal(res.statusCode, 404, `${request.method} ${request.url}`);
    }
  });

  it("lets members read but not write, and keeps the audit log for admins", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const member = await signUp(app);
    const organization = await createPanelOrganization(app, owner);
    await addPanelMember(app, owner, organization.id, member, "member");

    const read = await app.inject({ method: "GET", url: organizationUrl(organization.id, "/members"), headers: member.headers });
    const update = await app.inject({ method: "PATCH", url: organizationUrl(organization.id), headers: member.headers, payload: { name: "Hijacked" } });
    const invite = await app.inject({
      method: "POST",
      url: organizationUrl(organization.id, "/members"),
      headers: member.headers,
      payload: { email: owner.email, role: "admin" },
    });
    const audit = await app.inject({ method: "GET", url: organizationUrl(organization.id, "/audit-log"), headers: member.headers });

    assert.equal(read.statusCode, 200);
    assert.equal(read.json().data.length, 2);
    assert.equal(update.statusCode, 403);
    assert.equal(invite.statusCode, 403);
    assert.equal(audit.statusCode, 403);
  });

  it("lets only the owner deactivate, after which the organization is gone for everyone", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const admin = await signUp(app);
    const organization = await createPanelOrganization(app, owner);
    await addPanelMember(app, owner, organization.id, admin, "admin");

    const byAdmin = await app.inject({ method: "DELETE", url: organizationUrl(organization.id), headers: admin.headers });
    const byOwner = await app.inject({ method: "DELETE", url: organizationUrl(organization.id), headers: owner.headers });
    const afterwards = await app.inject({ method: "GET", url: organizationUrl(organization.id), headers: owner.headers });
    const list = await app.inject({ method: "GET", url: "/service/panel/organizations", headers: admin.headers });

    assert.equal(byAdmin.statusCode, 403);
    assert.equal(byOwner.statusCode, 204);
    assert.equal(afterwards.statusCode, 404);
    assert.deepEqual(list.json().data, []);
  });
});

describe("panel members", { skip: !hasDatabase }, () => {
  it("adds, re-roles and removes a member, auditing each change", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const person = await signUp(app, "Grace");
    const organization = await createPanelOrganization(app, owner);

    const added = await addPanelMember(app, owner, organization.id, person, "member");
    const promoted = await app.inject({
      method: "PATCH",
      url: organizationUrl(organization.id, `/members/${added.id}`),
      headers: owner.headers,
      payload: { role: "admin" },
    });
    const removed = await app.inject({ method: "DELETE", url: organizationUrl(organization.id, `/members/${added.id}`), headers: owner.headers });
    const audit = await app.inject({ method: "GET", url: organizationUrl(organization.id, "/audit-log"), headers: owner.headers });
    const lostAccess = await app.inject({ method: "GET", url: organizationUrl(organization.id), headers: person.headers });

    assert.equal(added.role, "member");
    assert.equal(promoted.json().role, "admin");
    assert.equal(removed.statusCode, 204);
    assert.deepEqual(
      audit.json().data.map((entry: { action: string }) => entry.action),
      ["member.removed", "member.role_updated", "member.added", "organization.created"],
    );
    assert.equal(lostAccess.statusCode, 404);
  });

  it("explains unknown users, duplicates, and unknown members", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const person = await signUp(app);
    const organization = await createPanelOrganization(app, owner);
    await addPanelMember(app, owner, organization.id, person, "member");

    const unknown = await app.inject({
      method: "POST",
      url: organizationUrl(organization.id, "/members"),
      headers: owner.headers,
      payload: { email: "nobody@example.test", role: "member" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: organizationUrl(organization.id, "/members"),
      headers: owner.headers,
      payload: { email: person.email.toUpperCase(), role: "admin" },
    });
    const missing = await app.inject({
      method: "DELETE",
      url: organizationUrl(organization.id, `/members/${uuidv7()}`),
      headers: owner.headers,
    });

    assert.equal(unknown.statusCode, 404);
    assert.equal(duplicate.statusCode, 409);
    assert.equal(missing.statusCode, 404);
  });

  it("protects the owner", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const admin = await signUp(app);
    const person = await signUp(app);
    const organization = await createPanelOrganization(app, owner);
    const adminMember = await addPanelMember(app, owner, organization.id, admin, "admin");
    const members = (
      await app.inject({ method: "GET", url: organizationUrl(organization.id, "/members"), headers: owner.headers })
    ).json().data as { id: string; role: string }[];
    const ownerMember = members.find((member) => member.role === "owner")!;

    const demote = await app.inject({
      method: "PATCH",
      url: organizationUrl(organization.id, `/members/${ownerMember.id}`),
      headers: admin.headers,
      payload: { role: "member" },
    });
    const remove = await app.inject({ method: "DELETE", url: organizationUrl(organization.id, `/members/${ownerMember.id}`), headers: admin.headers });
    const grant = await app.inject({
      method: "PATCH",
      url: organizationUrl(organization.id, `/members/${adminMember.id}`),
      headers: owner.headers,
      payload: { role: "owner" },
    });
    const inviteOwner = await app.inject({
      method: "POST",
      url: organizationUrl(organization.id, "/members"),
      headers: owner.headers,
      payload: { email: person.email, role: "owner" },
    });

    assert.equal(demote.statusCode, 409);
    assert.equal(remove.statusCode, 409);
    assert.equal(grant.statusCode, 400);
    assert.equal(inviteOwner.statusCode, 400);
  });
});

describe("panel request origin", { skip: !hasDatabase }, () => {
  it("rejects writes without the panel origin and allows reads", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const cookie = owner.headers.cookie;

    const missing = await app.inject({ method: "POST", url: "/service/panel/organizations", headers: { cookie }, payload: { name: "No origin" } });
    const foreign = await app.inject({
      method: "POST",
      url: "/service/panel/organizations",
      headers: { cookie, origin: "https://evil.example" },
      payload: { name: "Foreign" },
    });
    const read = await app.inject({ method: "GET", url: "/service/panel/organizations", headers: { cookie } });
    const allowed = await app.inject({
      method: "POST",
      url: "/service/panel/organizations",
      headers: { cookie, origin: PANEL_ORIGIN },
      payload: { name: "Allowed" },
    });
    deleteOrganizationAfterTest(app, allowed.json().id);

    assert.equal(missing.statusCode, 403);
    assert.equal(foreign.statusCode, 403);
    assert.equal(read.statusCode, 200);
    assert.equal(allowed.statusCode, 201);
  });
});

describe("root organization members", { skip: !hasDatabase }, () => {
  it("hands a root-created organization to its first owner, once", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const second = await signUp(app);
    const created = await app.inject({
      method: "POST",
      url: "/service/web/organizations",
      headers: auth(TEST_ROOT_KEY),
      payload: { name: "Provisioned" },
    });
    const organizationId = created.json().id;
    deleteOrganizationAfterTest(app, organizationId);
    const addOwner = (email: string) =>
      app.inject({
        method: "POST",
        url: `/service/web/organizations/${organizationId}/members`,
        headers: auth(TEST_ROOT_KEY),
        payload: { email, role: "owner" },
      });

    const first = await addOwner(owner.email);
    const again = await addOwner(second.email);
    const visible = await app.inject({ method: "GET", url: organizationUrl(organizationId), headers: owner.headers });
    const roles = await app.db.select().from(schema.roles).where(eq(schema.roles.organizationId, organizationId));

    assert.equal(created.json().slug.startsWith("provisioned-"), true);
    assert.equal(roles.length, 3);
    assert.equal(first.statusCode, 201);
    assert.equal(again.statusCode, 400);
    assert.equal(visible.json().role, "owner");
  });

  it("requires the root key", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const organization = await createPanelOrganization(app, owner);

    const res = await app.inject({
      method: "POST",
      url: `/service/web/organizations/${organization.id}/members`,
      headers: owner.headers,
      payload: { email: owner.email, role: "admin" },
    });

    assert.equal(res.statusCode, 401);
  });
});

describe("organization route permissions", () => {
  it("refuses to register an organization route without config.permissions", async () => {
    const app = Fastify();
    await app.register(async (scope) => {
      await scope.register(organizationHooks);
      scope.get("/declared", { config: { permissions: ["organization:view"] } }, async () => ({}));
    });
    await app.ready();

    const bare = Fastify();
    bare.register(async (scope) => {
      await scope.register(organizationHooks);
      scope.get("/undeclared", async () => ({}));
    });
    await assert.rejects(async () => bare.ready(), /must declare config.permissions/);
  });
});
