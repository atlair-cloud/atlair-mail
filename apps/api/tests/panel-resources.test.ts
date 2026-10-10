import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { schema, type EmailStatus } from "@atlair-mail/db";
import {
  addPanelMember,
  auth,
  buildPanelTestApp,
  createPanelOrganization,
  createTestKey,
  hasDatabase,
  signUp,
  type PanelUser,
} from "./helpers.ts";

type TestApp = Awaited<ReturnType<typeof buildPanelTestApp>>;

const panel = (organizationId: string, path: string) => `/service/panel/organizations/${organizationId}${path}`;

async function panelOrganizationWithKey(app: TestApp) {
  const owner = await signUp(app);
  const organization = await createPanelOrganization(app, owner);
  const created = await app.inject({
    method: "POST",
    url: panel(organization.id, "/api-keys"),
    headers: owner.headers,
    payload: { name: "Server" },
  });
  return { owner, organizationId: organization.id, token: created.json().token as string, keyId: created.json().id as string };
}

async function verifiedDomain(app: TestApp, organizationId: string) {
  const name = `${uuidv7()}.example.com`;
  const [domain] = await app.db
    .insert(schema.domains)
    .values({ organizationId, name, status: "verified" })
    .returning();
  return domain!;
}

async function insertEmails(app: TestApp, organizationId: string, statuses: EmailStatus[]) {
  const domain = await verifiedDomain(app, organizationId);
  const rows = [];
  for (const status of statuses) {
    const [row] = await app.db
      .insert(schema.emails)
      .values({
        organizationId,
        domainId: domain.id,
        fromAddress: `hello@${domain.name}`,
        toAddresses: ["ada@example.org"],
        subject: `Email ${status}`,
        textBody: "Hi",
        status,
      })
      .returning();
    rows.push(row!);
  }
  return rows;
}

describe("panel resources match the web API", { skip: !hasDatabase }, () => {
  it("manages API keys from the panel, and the keys work on /service/web", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId, token, keyId } = await panelOrganizationWithKey(app);

    const current = await app.inject({ method: "GET", url: "/service/web/api-keys/current", headers: auth(token) });
    const panelList = await app.inject({ method: "GET", url: panel(organizationId, "/api-keys"), headers: owner.headers });
    const webList = await app.inject({ method: "GET", url: "/service/web/api-keys", headers: auth(token) });
    const revoked = await app.inject({ method: "DELETE", url: panel(organizationId, `/api-keys/${keyId}`), headers: owner.headers });
    const afterRevoke = await app.inject({ method: "GET", url: "/service/web/api-keys/current", headers: auth(token) });

    assert.equal(current.json().organizationId, organizationId);
    assert.deepEqual(panelList.json(), webList.json());
    assert.equal(revoked.statusCode, 200);
    assert.ok(revoked.json().revokedAt);
    assert.equal(afterRevoke.statusCode, 401);
  });

  it("returns the same domains, provider, suppressions and webhooks on both surfaces", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId, token } = await panelOrganizationWithKey(app);
    const domain = await verifiedDomain(app, organizationId);

    const suppression = await app.inject({
      method: "POST",
      url: panel(organizationId, "/suppressions"),
      headers: owner.headers,
      payload: { address: "gone@example.org" },
    });
    const webhook = await app.inject({
      method: "POST",
      url: panel(organizationId, "/webhooks"),
      headers: owner.headers,
      payload: { url: "https://hooks.example.com/atlair", eventTypes: ["email.delivered"] },
    });

    const pairs = [
      ["/domains", "/service/web/domains"],
      [`/domains/${domain.id}`, `/service/web/domains/${domain.id}`],
      ["/provider", "/service/web/provider"],
      ["/suppressions", "/service/web/suppressions"],
      ["/webhooks", "/service/web/webhooks"],
      [`/webhooks/${webhook.json().id}`, `/service/web/webhooks/${webhook.json().id}`],
      [`/webhooks/${webhook.json().id}/deliveries`, `/service/web/webhooks/${webhook.json().id}/deliveries`],
    ] as const;

    assert.equal(suppression.statusCode, 201);
    assert.equal(webhook.statusCode, 201);
    assert.ok(webhook.json().signingSecret);
    for (const [panelPath, webPath] of pairs) {
      const fromPanel = await app.inject({ method: "GET", url: panel(organizationId, panelPath), headers: owner.headers });
      const fromWeb = await app.inject({ method: "GET", url: webPath, headers: auth(token) });
      assert.equal(fromPanel.statusCode, fromWeb.statusCode, panelPath);
      assert.deepEqual(fromPanel.json(), fromWeb.json(), panelPath);
    }
  });

  it("sends email from the panel without an API key", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await panelOrganizationWithKey(app);
    const domain = await verifiedDomain(app, organizationId);

    const res = await app.inject({
      method: "POST",
      url: panel(organizationId, "/emails"),
      headers: owner.headers,
      payload: { from: `hello@${domain.name}`, to: ["ada@example.org"], subject: "From the panel", text: "Hi" },
    });
    const [row] = await app.db.select().from(schema.emails).where(eq(schema.emails.id, res.json().id));
    const fetched = await app.inject({ method: "GET", url: panel(organizationId, `/emails/${res.json().id}`), headers: owner.headers });
    const events = await app.inject({
      method: "GET",
      url: panel(organizationId, `/emails/${res.json().id}/events`),
      headers: owner.headers,
    });

    assert.equal(res.statusCode, 202);
    assert.equal(row?.organizationId, organizationId);
    assert.equal(row?.apiKeyId, null);
    assert.equal(fetched.json().subject, "From the panel");
    assert.deepEqual(events.json(), { data: [] });
  });
});

describe("email list", { skip: !hasDatabase }, () => {
  it("lists newest first without bodies, pages with before, and filters by status", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId, token } = await panelOrganizationWithKey(app);
    const [first, second, third] = await insertEmails(app, organizationId, ["delivered", "bounced", "delivered"]);

    const all = await app.inject({ method: "GET", url: panel(organizationId, "/emails"), headers: owner.headers });
    const page = await app.inject({
      method: "GET",
      url: panel(organizationId, `/emails?limit=1&before=${second!.id}`),
      headers: owner.headers,
    });
    const delivered = await app.inject({ method: "GET", url: "/service/web/emails?status=delivered", headers: auth(token) });
    const invalid = await app.inject({ method: "GET", url: "/service/web/emails?status=lost", headers: auth(token) });

    assert.deepEqual(all.json().data.map((email: { id: string }) => email.id), [third!.id, second!.id, first!.id]);
    assert.deepEqual(Object.keys(all.json().data[0]).sort(), [
      "createdAt",
      "from",
      "id",
      "scheduledAt",
      "sentAt",
      "status",
      "subject",
      "to",
    ]);
    assert.deepEqual(page.json().data.map((email: { id: string }) => email.id), [first!.id]);
    assert.deepEqual(delivered.json().data.map((email: { id: string }) => email.id), [third!.id, first!.id]);
    assert.equal(invalid.statusCode, 400);
  });

  it("only lists the organization's own emails, and a sending_access key can read it", async () => {
    const app = await buildPanelTestApp();
    const { organizationId } = await panelOrganizationWithKey(app);
    await insertEmails(app, organizationId, ["delivered"]);
    const other = await createTestKey(app, { permission: "sending_access" });

    const res = await app.inject({ method: "GET", url: "/service/web/emails", headers: auth(other.token) });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, []);
  });
});

describe("panel resource permissions", { skip: !hasDatabase }, () => {
  async function organizationWith(app: TestApp, role: "admin" | "member") {
    const owner = await signUp(app);
    const person = await signUp(app);
    const organization = await createPanelOrganization(app, owner);
    await addPanelMember(app, owner, organization.id, person, role);
    return { organizationId: organization.id, person };
  }

  const writes = (organizationId: string) => [
    { method: "POST", url: panel(organizationId, "/api-keys"), payload: { name: "Mine" } },
    { method: "POST", url: panel(organizationId, "/domains"), payload: { name: "example.com" } },
    {
      method: "PUT",
      url: panel(organizationId, "/provider"),
      payload: { provider: "ses", region: "us-east-1", accessKeyId: "AKIA", secretAccessKey: "secret" },
    },
    { method: "DELETE", url: panel(organizationId, "/provider") },
    { method: "POST", url: panel(organizationId, "/suppressions"), payload: { address: "x@example.org" } },
    {
      method: "POST",
      url: panel(organizationId, "/webhooks"),
      payload: { url: "https://hooks.example.com/x", eventTypes: ["email.delivered"] },
    },
  ] as const;

  it("lets members read everything and send, but not change settings", async () => {
    const app = await buildPanelTestApp();
    const { organizationId, person } = await organizationWith(app, "member");
    const domain = await verifiedDomain(app, organizationId);

    for (const path of ["/api-keys", "/domains", "/emails", "/suppressions", "/webhooks"]) {
      const res = await app.inject({ method: "GET", url: panel(organizationId, path), headers: person.headers });
      assert.equal(res.statusCode, 200, path);
    }
    for (const request of writes(organizationId)) {
      const res = await app.inject({ ...request, headers: person.headers });
      assert.equal(res.statusCode, 403, `${request.method} ${request.url}`);
    }
    const sent = await app.inject({
      method: "POST",
      url: panel(organizationId, "/emails"),
      headers: person.headers,
      payload: { from: `hello@${domain.name}`, to: ["ada@example.org"], subject: "Hi", text: "Hi" },
    });
    assert.equal(sent.statusCode, 202);
  });

  it("lets admins change settings", async () => {
    const app = await buildPanelTestApp();
    const { organizationId, person } = await organizationWith(app, "admin");

    const key = await app.inject({
      method: "POST",
      url: panel(organizationId, "/api-keys"),
      headers: person.headers,
      payload: { name: "Admin key" },
    });
    const suppression = await app.inject({
      method: "POST",
      url: panel(organizationId, "/suppressions"),
      headers: person.headers,
      payload: { address: "x@example.org" },
    });

    assert.equal(key.statusCode, 201);
    assert.equal(suppression.statusCode, 201);
  });

  it("hides every resource route from non-members behind 404", async () => {
    const app = await buildPanelTestApp();
    const { organizationId } = await panelOrganizationWithKey(app);
    const outsider: PanelUser = await signUp(app);
    const id = uuidv7();

    const requests = [
      ...writes(organizationId),
      { method: "GET", url: panel(organizationId, "/api-keys") },
      { method: "DELETE", url: panel(organizationId, `/api-keys/${id}`) },
      { method: "GET", url: panel(organizationId, "/domains") },
      { method: "GET", url: panel(organizationId, `/domains/${id}`) },
      { method: "POST", url: panel(organizationId, `/domains/${id}/verify`) },
      { method: "DELETE", url: panel(organizationId, `/domains/${id}`) },
      { method: "GET", url: panel(organizationId, "/emails") },
      { method: "GET", url: panel(organizationId, `/emails/${id}`) },
      { method: "GET", url: panel(organizationId, `/emails/${id}/events`) },
      { method: "GET", url: panel(organizationId, "/provider") },
      { method: "POST", url: panel(organizationId, "/provider/events"), payload: { mode: "pull" } },
      { method: "POST", url: panel(organizationId, "/provider/events/redrive") },
      { method: "GET", url: panel(organizationId, "/suppressions") },
      { method: "DELETE", url: panel(organizationId, `/suppressions/${id}`) },
      { method: "GET", url: panel(organizationId, "/webhooks") },
      { method: "GET", url: panel(organizationId, `/webhooks/${id}`) },
      { method: "PATCH", url: panel(organizationId, `/webhooks/${id}`), payload: { enabled: false } },
      { method: "POST", url: panel(organizationId, `/webhooks/${id}/rotate-secret`), payload: {} },
      { method: "DELETE", url: panel(organizationId, `/webhooks/${id}`) },
      { method: "GET", url: panel(organizationId, `/webhooks/${id}/deliveries`) },
    ] as const;

    for (const request of requests) {
      const res = await app.inject({ ...request, headers: outsider.headers });
      assert.equal(res.statusCode, 404, `${request.method} ${request.url}`);
    }
  });
});
