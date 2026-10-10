import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
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
    const updated = await call(app, full, "PATCH", `/templates/${id}`, { version: 1, subject: "Hello {{first_name}}" });
    const stale = await call(app, full, "PATCH", `/templates/${id}`, { version: 1, name: "Old copy" });
    const removed = await call(app, full, "DELETE", `/templates/${id}`);
    const gone = await call(app, full, "GET", `/templates/${id}`);

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().version, 1);
    assert.equal(created.json().createdBy.type, "api_key");
    assert.equal(byAlias.json().id, id);
    assert.equal(page.json().data.length, 1);
    assert.equal(page.json().hasMore, true);
    assert.equal(page.json().data[0].content, undefined);
    assert.deepEqual(searched.json().data.map((template: { id: string }) => template.id), [id]);
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().version, 2);
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
    const change = await call(app, sending, "PATCH", `/templates/${id}`, { version: 1, name: "x" });

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
    await call(app, full, "PATCH", `/templates/${id}`, { version: 1, name: "Welcome v2" });
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
    assert.deepEqual(email.template, { id, version: 2 });
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
    await call(app, full, "POST", "/templates", welcome({ alias: "welcome" }));
    const theirs = (await call(app, other.token, "POST", "/templates", welcome({ alias: "theirs" }))).json();
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

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().createdBy.type, "user");
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().data.length, 1);
    assert.equal(write.statusCode, 403);
  });
});
