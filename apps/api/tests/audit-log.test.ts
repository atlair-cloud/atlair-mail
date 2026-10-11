import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { auth, buildPanelTestApp, createPanelOrganization, hasDatabase, signUp, type PanelUser } from "./helpers.ts";

type TestApp = Awaited<ReturnType<typeof buildPanelTestApp>>;

type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  actor: { id: string; name: string } | null;
  apiKey: { id: string; name: string } | null;
};

const panel = (organizationId: string, path: string) => `/service/panel/organizations/${organizationId}${path}`;

const template = () => ({
  name: `Welcome ${uuidv7()}`,
  subject: "Welcome",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] },
});

async function setUp(app: TestApp) {
  const owner = await signUp(app, "Ada Owner");
  const organization = await createPanelOrganization(app, owner);
  const call = (method: "POST" | "PATCH" | "DELETE", path: string, payload?: object) =>
    app.inject({ method, url: panel(organization.id, path), headers: owner.headers, ...(payload && { payload }) });
  const auditLog = async (who: PanelUser = owner) => {
    const res = await app.inject({ method: "GET", url: panel(organization.id, "/audit-log"), headers: who.headers });
    assert.equal(res.statusCode, 200);
    return (res.json().data as AuditEntry[]).reverse().filter((entry) => entry.action !== "organization.created");
  };
  return { owner, organizationId: organization.id, call, auditLog };
}

describe("audit log", { skip: !hasDatabase }, () => {
  it("records template changes from the panel, but not draft edits", async () => {
    const app = await buildPanelTestApp();
    const { owner, call, auditLog } = await setUp(app);

    const created = (await call("POST", "/templates", template())).json();
    const edited = (await call("PATCH", `/templates/${created.id}`, { revision: 1, subject: "Hello again" })).json();
    const renamed = (await call("PATCH", `/templates/${created.id}`, { revision: edited.revision, name: "Onboarding", alias: "onboarding" })).json();
    await call("POST", `/templates/${created.id}/publish`, { note: "Launch" });
    await call("POST", `/templates/${created.id}/versions/1/publish`, { revision: renamed.revision });
    await call("DELETE", `/templates/${created.id}`);
    await call("DELETE", `/templates/${uuidv7()}`);

    const entries = await auditLog();
    assert.deepEqual(
      entries.map((entry) => entry.action),
      ["template.created", "template.renamed", "template.published", "template.rolled_back", "template.deleted"],
    );
    assert.ok(entries.every((entry) => entry.entityType === "template" && entry.entityId === created.id));
    assert.ok(entries.every((entry) => entry.actor?.id === owner.id && entry.apiKey === null));
    assert.deepEqual(entries[1]!.changes, {
      before: { name: created.name, alias: null },
      after: { name: "Onboarding", alias: "onboarding" },
    });
    assert.deepEqual(entries[2]!.changes, { name: "Onboarding", version: 1, note: "Launch" });
    assert.deepEqual(entries[3]!.changes, { name: "Onboarding", from: 1, version: 2 });
    assert.deepEqual(entries[4]!.changes, { name: "Onboarding" });
  });

  it("records API keys, webhooks and suppressions, once per real change", async () => {
    const app = await buildPanelTestApp();
    const { call, auditLog } = await setUp(app);

    const key = (await call("POST", "/api-keys", { name: "Billing" })).json();
    await call("DELETE", `/api-keys/${key.id}`);
    await call("DELETE", `/api-keys/${key.id}`);

    const webhook = (
      await call("POST", "/webhooks", { url: "https://hooks.example.com/atlair", eventTypes: ["email.delivered"] })
    ).json();
    await call("PATCH", `/webhooks/${webhook.id}`, { eventTypes: ["email.delivered", "email.bounced"] });
    await call("PATCH", `/webhooks/${webhook.id}`, { enabled: false });
    await call("POST", `/webhooks/${webhook.id}/rotate-secret`, { overlapHours: 1 });
    await call("DELETE", `/webhooks/${webhook.id}`);

    const suppression = (await call("POST", "/suppressions", { address: "Ada@Example.org" })).json();
    await call("POST", "/suppressions", { address: "ada@example.org" });
    await call("DELETE", `/suppressions/${suppression.id}`);

    const entries = await auditLog();
    assert.deepEqual(
      entries.map((entry) => entry.action),
      [
        "api_key.created",
        "api_key.revoked",
        "webhook.created",
        "webhook.updated",
        "webhook.disabled",
        "webhook.secret_rotated",
        "webhook.deleted",
        "suppression.added",
        "suppression.removed",
      ],
    );
    assert.deepEqual(entries[0]!.changes, { name: "Billing", permission: "full_access" });
    assert.deepEqual(entries[3]!.changes, {
      url: "https://hooks.example.com/atlair",
      before: { url: "https://hooks.example.com/atlair", eventTypes: ["delivered"] },
      after: { url: "https://hooks.example.com/atlair", eventTypes: ["delivered", "bounced"] },
    });
    assert.deepEqual(entries[5]!.changes, { url: "https://hooks.example.com/atlair", overlapHours: 1 });
    assert.deepEqual(entries[7]!.changes, { address: "ada@example.org" });
    assert.deepEqual(entries[8]!.changes, { address: "ada@example.org" });
  });

  it("names the API key when a change comes through the API", async () => {
    const app = await buildPanelTestApp();
    const { call, auditLog } = await setUp(app);
    const key = (await call("POST", "/api-keys", { name: "Deploy bot" })).json();

    const created = await app.inject({ method: "POST", url: "/service/web/templates", headers: auth(key.token), payload: template() });

    const entry = (await auditLog()).at(-1)!;
    assert.equal(created.statusCode, 201);
    assert.equal(entry.action, "template.created");
    assert.equal(entry.actor, null);
    assert.deepEqual(entry.apiKey, { id: key.id, name: "Deploy bot" });
  });
});
