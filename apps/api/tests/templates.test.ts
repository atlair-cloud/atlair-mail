import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { eq } from "drizzle-orm";
import { schema } from "@atlair-mail/db";
import { auth, buildPanelTestApp, createPanelOrganization, createTestKey, hasDatabase, signUp } from "./helpers.ts";

type TestApp = Awaited<ReturnType<typeof buildPanelTestApp>>;

const panel = (organizationId: string, path: string) => `/service/panel/organizations/${organizationId}${path}`;

const text = (value: string) => ({ type: "text", text: value });

const welcome = (overrides: object = {}) => ({
  name: `Welcome ${uuidv7()}`,
  subject: "Welcome, {{first_name}}",
  content: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [text("Hi "), { type: "variable", attrs: { name: "first_name" } }] },
      { type: "button", attrs: { text: "Get started", href: "https://example.com/start?plan={{plan}}" } },
    ],
  },
  variables: [
    { key: "first_name", type: "string", fallback: "there" },
    { key: "plan", type: "string" },
  ],
  ...overrides,
});

async function organization(app: TestApp) {
  const owner = await signUp(app);
  const { id: organizationId } = await createPanelOrganization(app, owner);
  const key = async (permission?: "sending_access") =>
    (
      await app.inject({
        method: "POST",
        url: panel(organizationId, "/api-keys"),
        headers: owner.headers,
        payload: { name: permission ?? "full", ...(permission && { permission }) },
      })
    ).json().token as string;
  const domain = `${uuidv7()}.example.com`;
  await app.db.insert(schema.domains).values({ organizationId, name: domain, status: "verified" });
  return { owner, organizationId, full: await key(), sending: await key("sending_access"), from: `Acme <hello@${domain}>` };
}

const publish = (app: TestApp, token: string, id: string, payload: object = {}) => call(app, token, "POST", `/templates/${id}/publish`, payload);

const call = (app: TestApp, token: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url: `/service/web${url}`, headers: auth(token), ...(payload && { payload }) });

describe("templates", { skip: !hasDatabase }, () => {
  it("creates, finds by id or alias, lists, updates and deletes", async () => {
    const app = await buildPanelTestApp();
    const { full } = await organization(app);

    const created = await call(app, full, "POST", "/templates", welcome({ name: "Welcome", alias: "welcome" }));
    const id = created.json().id as string;
    await call(app, full, "POST", "/templates", welcome({ name: "Receipt" }));
    const byAlias = await call(app, full, "GET", "/templates/welcome");
    const page = await call(app, full, "GET", "/templates?limit=1");
    const searched = await call(app, full, "GET", "/templates?search=WELC");
    const updated = await call(app, full, "PATCH", `/templates/${id}`, { revision: 1, subject: "Hello {{first_name}}" });
    const stale = await call(app, full, "PATCH", `/templates/${id}`, { revision: 1, name: "Old copy" });
    const removed = await call(app, full, "DELETE", `/templates/${id}`);
    const gone = await call(app, full, "GET", `/templates/${id}`);

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().revision, 1);
    assert.equal(created.json().publishedVersion, null);
    assert.equal(created.json().hasUnpublishedChanges, true);
    assert.equal(created.json().createdBy.type, "api_key");
    assert.equal(byAlias.json().id, id);
    assert.equal(page.json().data.length, 1);
    assert.equal(page.json().hasMore, true);
    assert.equal(page.json().data[0].content, undefined);
    assert.deepEqual(searched.json().data.map((template: { id: string }) => template.id), [id]);
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().revision, 2);
    assert.equal(updated.json().subject, "Hello {{first_name}}");
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().code, "ATL_TEMPLATE_CHANGED");
    assert.equal(removed.statusCode, 204);
    assert.equal(gone.statusCode, 404);
  });

  it("explains what's wrong with a template", async () => {
    const app = await buildPanelTestApp();
    const { full } = await organization(app);
    await call(app, full, "POST", "/templates", welcome({ name: "Taken", alias: "taken" }));

    const undeclared = await call(app, full, "POST", "/templates", welcome({ variables: [] }));
    const unsafe = await call(app, full, "POST", "/templates", welcome({
      content: { type: "doc", content: [{ type: "button", attrs: { text: "Go", href: "javascript:alert(1)" } }] },
    }));
    const sameName = await call(app, full, "POST", "/templates", welcome({ name: "Taken" }));
    const sameAlias = await call(app, full, "POST", "/templates", welcome({ alias: "taken" }));
    const idAlias = await call(app, full, "POST", "/templates", welcome({ alias: uuidv7() }));

    assert.equal(undeclared.statusCode, 422);
    assert.equal(undeclared.json().code, "ATL_TEMPLATE_INVALID");
    assert.match(undeclared.json().message, /declare first_name, plan/);
    assert.equal(unsafe.statusCode, 422);
    assert.match(unsafe.json().message, /content\.content\[0\]\.attrs\.href/);
    assert.equal(sameName.statusCode, 409);
    assert.match(sameName.json().message, /name/);
    assert.equal(sameAlias.statusCode, 409);
    assert.match(sameAlias.json().message, /alias/);
    assert.equal(idAlias.statusCode, 422);
  });

  it("previews saved and unsaved templates, and a sending key can read but not change them", async () => {
    const app = await buildPanelTestApp();
    const { full, sending } = await organization(app);
    const { id } = (await call(app, full, "POST", "/templates", welcome({ alias: "welcome" }))).json();

    const saved = await call(app, sending, "POST", "/templates/welcome/preview", { variables: { first_name: "Ada" } });
    const draft = await call(app, full, "POST", "/templates/preview", { ...welcome(), name: undefined, values: { plan: "pro" } });
    const listed = await call(app, sending, "GET", "/templates");
    const create = await call(app, sending, "POST", "/templates", welcome());
    const change = await call(app, sending, "PATCH", `/templates/${id}`, { revision: 1, name: "x" });

    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json().subject, "Welcome, Ada");
    assert.match(saved.json().html, /plan=\{\{plan\}\}/);
    assert.equal(draft.statusCode, 200);
    assert.equal(draft.json().subject, "Welcome, there");
    assert.match(draft.json().text, /plan=pro/);
    assert.equal(listed.statusCode, 200);
    assert.equal(create.statusCode, 403);
    assert.equal(change.statusCode, 403);
  });

  it("sends an email from a template and records which version", async () => {
    const app = await buildPanelTestApp();
    const { full, sending, from } = await organization(app);
    const { id } = (await call(app, full, "POST", "/templates", welcome({ alias: "welcome" }))).json();
    await call(app, full, "PATCH", `/templates/${id}`, { revision: 1, name: "Welcome v2" });
    await publish(app, full, id);
    const message = { from, to: ["ada@example.org"], template: { id: "welcome", variables: { first_name: "Ada", plan: "pro" } } };

    const sent = await call(app, sending, "POST", "/emails", message);
    const replay = await app.inject({
      method: "POST",
      url: "/service/web/emails",
      headers: { ...auth(sending), "idempotency-key": "welcome-ada" },
      payload: message,
    });
    const again = await app.inject({
      method: "POST",
      url: "/service/web/emails",
      headers: { ...auth(sending), "idempotency-key": "welcome-ada" },
      payload: message,
    });
    const overridden = await call(app, sending, "POST", "/emails", { ...message, subject: "Your account is ready" });
    const email = (await call(app, full, "GET", `/emails/${sent.json().id}`)).json();

    assert.equal(sent.statusCode, 202);
    assert.equal(email.subject, "Welcome, Ada");
    assert.match(email.html, /Hi Ada/);
    assert.match(email.text, /plan=pro/);
    assert.deepEqual(email.template, { id, version: 1 });
    assert.equal(replay.statusCode, 202);
    assert.equal(again.headers["idempotent-replayed"], "true");
    assert.equal(again.json().id, replay.json().id);
    assert.equal((await call(app, full, "GET", `/emails/${overridden.json().id}`)).json().subject, "Your account is ready");
  });

  it("keeps numbers as numbers in fallbacks and values", async () => {
    const app = await buildPanelTestApp();
    const { full, from } = await organization(app);
    const template = welcome({
      alias: "reset",
      subject: "Reset within {{minutes}} minutes",
      content: { type: "doc", content: [{ type: "paragraph", content: [text("Valid for {{minutes}} minutes")] }] },
      variables: [{ key: "minutes", type: "number", fallback: 30 }],
    });

    const created = await call(app, full, "POST", "/templates", template);
    await publish(app, full, created.json().id);
    const fallback = await call(app, full, "POST", "/templates/reset/preview", {});
    const value = await call(app, full, "POST", "/templates/reset/preview", { variables: { minutes: 15 } });
    const asText = await call(app, full, "POST", "/emails", { from, to: ["ada@example.org"], template: { id: "reset", variables: { minutes: "15" } } });

    assert.equal(created.statusCode, 201);
    assert.deepEqual(created.json().variables, [{ key: "minutes", type: "number", fallback: 30 }]);
    assert.equal(fallback.json().subject, "Reset within 30 minutes");
    assert.equal(value.json().subject, "Reset within 15 minutes");
    assert.equal(asText.statusCode, 422);
    assert.match(asText.json().message, /wrong type or too long: minutes/);
  });

  it("refuses a template send that can't be rendered", async () => {
    const app = await buildPanelTestApp();
    const { full, from } = await organization(app);
    const other = await createTestKey(app);
    await publish(app, full, (await call(app, full, "POST", "/templates", welcome({ alias: "welcome" }))).json().id);
    const theirs = (await call(app, other.token, "POST", "/templates", welcome({ alias: "theirs" }))).json();
    await publish(app, other.token, theirs.id);
    const send = (payload: object) => call(app, full, "POST", "/emails", { from, to: ["ada@example.org"], ...payload });

    const missing = await send({ template: { id: "welcome" } });
    const withBody = await send({ template: { id: "welcome", variables: { plan: "pro" } }, html: "<p>Hi</p>" });
    const noSubject = await send({ html: "<p>Hi</p>" });
    const unknown = await send({ template: { id: "nope" } });
    const foreign = await send({ template: { id: theirs.id, variables: { plan: "pro" } } });

    assert.equal(missing.statusCode, 422);
    assert.equal(missing.json().code, "ATL_TEMPLATE_VARIABLES");
    assert.match(missing.json().message, /missing plan/);
    assert.equal(withBody.statusCode, 400);
    assert.equal(withBody.json().code, "ATL_TEMPLATE_WITH_BODY");
    assert.equal(noSubject.statusCode, 400);
    assert.equal(noSubject.json().code, "ATL_SUBJECT_REQUIRED");
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().code, "ATL_TEMPLATE_NOT_FOUND");
    assert.equal(foreign.statusCode, 404);
  });

  it("lets owners manage templates in the panel and members only read them", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await organization(app);
    const member = await signUp(app);
    await app.inject({
      method: "POST",
      url: panel(organizationId, "/members"),
      headers: owner.headers,
      payload: { email: member.email, role: "member" },
    });

    const created = await app.inject({ method: "POST", url: panel(organizationId, "/templates"), headers: owner.headers, payload: welcome() });
    const read = await app.inject({ method: "GET", url: panel(organizationId, "/templates"), headers: member.headers });
    const write = await app.inject({ method: "POST", url: panel(organizationId, "/templates"), headers: member.headers, payload: welcome() });
    const publishUrl = panel(organizationId, `/templates/${created.json().id}/publish`);
    const memberPublish = await app.inject({ method: "POST", url: publishUrl, headers: member.headers, payload: {} });
    const ownerPublish = await app.inject({ method: "POST", url: publishUrl, headers: owner.headers, payload: { note: "Launch" } });
    const history = await app.inject({ method: "GET", url: panel(organizationId, `/templates/${created.json().id}/versions`), headers: member.headers });

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().createdBy.type, "user");
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().data.length, 1);
    assert.equal(write.statusCode, 403);
    assert.equal(memberPublish.statusCode, 403);
    assert.equal(ownerPublish.statusCode, 200);
    assert.equal(ownerPublish.json().publishedVersion, 1);
    assert.equal(ownerPublish.json().updatedBy.type, "user");
    assert.equal(history.statusCode, 200);
    assert.equal(history.json().data[0].publishedBy.type, "user");
    assert.equal(history.json().data[0].note, "Launch");
  });

  it("sends the published version, never the unpublished draft", async () => {
    const app = await buildPanelTestApp();
    const { full, sending, from } = await organization(app);
    const { id } = (await call(app, full, "POST", "/templates", welcome({ alias: "welcome" }))).json();
    const send = async (template: object) => {
      const sent = await call(app, sending, "POST", "/emails", {
        from,
        to: ["ada@example.org"],
        template: { id: "welcome", variables: { first_name: "Ada", plan: "pro" }, ...template },
      });
      return sent.statusCode === 202 ? (await call(app, full, "GET", `/emails/${sent.json().id}`)).json() : sent.json();
    };

    const unpublished = await send({});
    const draftTest = await send({ version: "draft" });
    const first = await publish(app, full, id, { revision: 1, note: "First" });
    const unchanged = await publish(app, full, id);
    const renamed = await call(app, full, "PATCH", `/templates/${id}`, { revision: 1, name: "Welcome renamed" });
    const changedBack = await call(app, full, "PATCH", `/templates/${id}`, { revision: 2, subject: "Changed {{first_name}}" });
    const undone = await call(app, full, "PATCH", `/templates/${id}`, { revision: 3, subject: "Welcome, {{first_name}}" });
    const edited = await call(app, full, "PATCH", `/templates/${id}`, { revision: 4, subject: "Hello {{first_name}}" });
    const stillFirst = await send({});
    const stale = await publish(app, full, id, { revision: 1 });
    const second = await publish(app, full, id, { revision: 5 });
    const latest = await send({});
    const pinned = await send({ version: 1 });
    const missing = await send({ version: 9 });
    const badChoice = await call(app, sending, "POST", "/emails", { from, to: ["ada@example.org"], template: { id: "welcome", version: "latest" } });
    const preview = await call(app, sending, "POST", "/templates/welcome/preview", { version: 1, variables: { first_name: "Ada" } });
    const versions = await call(app, sending, "GET", "/templates/welcome/versions");
    const firstVersion = await call(app, sending, "GET", "/templates/welcome/versions/1");
    const sendingPublish = await publish(app, sending, id);

    assert.equal(unpublished.code, "ATL_TEMPLATE_NOT_PUBLISHED");
    assert.deepEqual(draftTest.template, { id, version: null });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().publishedVersion, 1);
    assert.equal(first.json().hasUnpublishedChanges, false);
    assert.equal(unchanged.json().latestVersion, 1);
    assert.equal(renamed.json().hasUnpublishedChanges, false);
    assert.equal(changedBack.json().hasUnpublishedChanges, true);
    assert.equal(undone.json().hasUnpublishedChanges, false);
    assert.equal(edited.json().hasUnpublishedChanges, true);
    assert.equal(stillFirst.subject, "Welcome, Ada");
    assert.deepEqual(stillFirst.template, { id, version: 1 });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().code, "ATL_TEMPLATE_CHANGED");
    assert.equal(second.json().publishedVersion, 2);
    assert.equal(latest.subject, "Hello Ada");
    assert.deepEqual(latest.template, { id, version: 2 });
    assert.equal(pinned.subject, "Welcome, Ada");
    assert.deepEqual(pinned.template, { id, version: 1 });
    assert.equal(missing.code, "ATL_TEMPLATE_VERSION_NOT_FOUND");
    assert.equal(badChoice.statusCode, 400);
    assert.equal(preview.json().subject, "Welcome, Ada");
    assert.deepEqual(versions.json().data.map((version: { number: number }) => version.number), [2, 1]);
    assert.deepEqual(versions.json().data.map((version: { isPublished: boolean }) => version.isPublished), [true, false]);
    assert.equal(versions.json().data[1].note, "First");
    assert.equal(versions.json().data[0].content, undefined);
    assert.equal(versions.json().data[0].publishedBy.type, "api_key");
    assert.equal(firstVersion.json().subject, "Welcome, {{first_name}}");
    assert.equal(firstVersion.json().content.type, "doc");
    assert.equal(sendingPublish.statusCode, 403);
  });

  it("restores and rolls back without rewriting history", async () => {
    const app = await buildPanelTestApp();
    const { full } = await organization(app);
    const other = await createTestKey(app);
    const { id } = (await call(app, full, "POST", "/templates", welcome())).json();
    await publish(app, full, id);
    await call(app, full, "PATCH", `/templates/${id}`, { revision: 1, subject: "Second {{first_name}}" });
    await publish(app, full, id);

    const restored = await call(app, full, "POST", `/templates/${id}/versions/1/restore`, { revision: 2 });
    const staleRestore = await call(app, full, "POST", `/templates/${id}/versions/1/restore`, { revision: 2 });
    const unknown = await call(app, full, "POST", `/templates/${id}/versions/9/restore`, { revision: 3 });
    const huge = await call(app, full, "GET", `/templates/${id}/versions/99999999999`);
    const foreignRead = await call(app, other.token, "GET", `/templates/${id}/versions`);
    const foreignRollback = await call(app, other.token, "POST", `/templates/${id}/versions/1/publish`, { revision: 3 });
    const rolledBack = await call(app, full, "POST", `/templates/${id}/versions/1/publish`, { revision: 3 });
    const versions = (await call(app, full, "GET", `/templates/${id}/versions?limit=2`)).json();
    const older = (await call(app, full, "GET", `/templates/${id}/versions?before=2`)).json();

    assert.equal(restored.statusCode, 200);
    assert.equal(restored.json().subject, "Welcome, {{first_name}}");
    assert.equal(restored.json().revision, 3);
    assert.equal(restored.json().publishedVersion, 2);
    assert.equal(restored.json().hasUnpublishedChanges, true);
    assert.equal(staleRestore.statusCode, 409);
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().code, "ATL_TEMPLATE_VERSION_NOT_FOUND");
    assert.equal(huge.statusCode, 400);
    assert.equal(foreignRead.statusCode, 404);
    assert.equal(foreignRollback.statusCode, 404);
    assert.equal(rolledBack.statusCode, 200);
    assert.equal(rolledBack.json().publishedVersion, 3);
    assert.equal(rolledBack.json().revision, 4);
    assert.equal(rolledBack.json().hasUnpublishedChanges, false);
    assert.deepEqual(versions.data.map((version: { number: number }) => version.number), [3, 2]);
    assert.equal(versions.data[0].note, "Rolled back to v1");
    assert.equal(versions.data[0].subject, "Welcome, {{first_name}}");
    assert.equal(versions.hasMore, true);
    assert.deepEqual(older.data.map((version: { number: number }) => version.number), [1]);
  });

  it("publishes once when the same draft is published at the same time, and deletes versions with the template", async () => {
    const app = await buildPanelTestApp();
    const { full } = await organization(app);
    const { id } = (await call(app, full, "POST", "/templates", welcome())).json();

    const results = await Promise.all(Array.from({ length: 5 }, () => publish(app, full, id, { revision: 1 })));
    const versions = (await call(app, full, "GET", `/templates/${id}/versions`)).json();
    await call(app, full, "DELETE", `/templates/${id}`);
    const left = await app.db.select().from(schema.templateVersions).where(eq(schema.templateVersions.templateId, id));

    assert.deepEqual(results.map((result) => result.statusCode), [200, 200, 200, 200, 200]);
    assert.equal(versions.data.length, 1);
    assert.equal(left.length, 0);
  });
});
