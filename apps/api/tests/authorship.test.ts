import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { schema, suppressAddresses } from "@atlair-mail/db";
import { auth, buildPanelTestApp, createPanelOrganization, hasDatabase, signUp } from "./helpers.ts";

const panel = (organizationId: string, path: string) => `/service/panel/organizations/${organizationId}${path}`;

describe("who created and changed a resource", { skip: !hasDatabase }, () => {
  it("records the member in the panel and the API key on /service/web", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app, "Ada Owner");
    const { id: organizationId } = await createPanelOrganization(app, owner);
    const member = { type: "user", id: owner.id, name: "Ada Owner" };

    const key = (
      await app.inject({
        method: "POST",
        url: panel(organizationId, "/api-keys"),
        headers: owner.headers,
        payload: { name: "Server" },
      })
    ).json();
    const apiKey = { type: "api_key", id: key.id, name: "Server" };

    const created = (
      await app.inject({
        method: "POST",
        url: panel(organizationId, "/webhooks"),
        headers: owner.headers,
        payload: { url: "https://hooks.example.com/atlair", eventTypes: ["email.delivered"] },
      })
    ).json();
    const updated = (
      await app.inject({
        method: "PATCH",
        url: `/service/web/webhooks/${created.id}`,
        headers: auth(key.token),
        payload: { enabled: false },
      })
    ).json();
    const suppression = (
      await app.inject({
        method: "POST",
        url: "/service/web/suppressions",
        headers: auth(key.token),
        payload: { address: "gone@example.org" },
      })
    ).json();

    assert.deepEqual(key.createdBy, member);
    assert.deepEqual(created.createdBy, member);
    assert.deepEqual(created.updatedBy, member);
    assert.deepEqual(updated.createdBy, member);
    assert.deepEqual(updated.updatedBy, apiKey);
    assert.ok(new Date(updated.updatedAt) >= new Date(created.updatedAt));
    assert.deepEqual(suppression.createdBy, apiKey);
  });

  it("names who sent an email, added a member and renamed the organization", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app, "Ada Owner");
    const teammate = await signUp(app, "Grace Teammate");
    const { id: organizationId } = await createPanelOrganization(app, owner);
    const member = { type: "user", id: owner.id, name: "Ada Owner" };
    const [domain] = await app.db
      .insert(schema.domains)
      .values({ organizationId, name: `${uuidv7()}.example.com`, status: "verified" })
      .returning();
    const key = (
      await app.inject({ method: "POST", url: panel(organizationId, "/api-keys"), headers: owner.headers, payload: { name: "Server" } })
    ).json();
    const message = { from: `hello@${domain!.name}`, to: ["ada@example.org"], subject: "Hi", text: "Hi" };

    const fromPanel = (
      await app.inject({ method: "POST", url: panel(organizationId, "/emails"), headers: owner.headers, payload: message })
    ).json();
    const fromKey = (
      await app.inject({ method: "POST", url: "/service/web/emails", headers: auth(key.token), payload: message })
    ).json();
    const sentFromPanel = (
      await app.inject({ method: "GET", url: panel(organizationId, `/emails/${fromPanel.id}`), headers: owner.headers })
    ).json();
    const listed = (await app.inject({ method: "GET", url: panel(organizationId, "/emails"), headers: owner.headers })).json();
    const added = (
      await app.inject({
        method: "POST",
        url: panel(organizationId, "/members"),
        headers: owner.headers,
        payload: { email: teammate.email, role: "member" },
      })
    ).json();
    const changed = (
      await app.inject({
        method: "PATCH",
        url: panel(organizationId, `/members/${added.id}`),
        headers: owner.headers,
        payload: { role: "admin" },
      })
    ).json();
    const renamed = (
      await app.inject({ method: "PATCH", url: panel(organizationId, ""), headers: owner.headers, payload: { name: "Acme 2" } })
    ).json();
    const organization = (await app.inject({ method: "GET", url: panel(organizationId, ""), headers: owner.headers })).json();

    assert.deepEqual(sentFromPanel.createdBy, member);
    assert.deepEqual(
      listed.data.find((email: { id: string }) => email.id === fromKey.id).createdBy,
      { type: "api_key", id: key.id, name: "Server" },
    );
    assert.deepEqual(added.createdBy, member);
    assert.deepEqual(changed.updatedBy, member);
    assert.deepEqual(renamed.updatedBy, member);
    assert.deepEqual(organization.createdBy, member);
    assert.deepEqual(organization.updatedBy, member);
  });

  it("leaves automatic changes without an author", async () => {
    const app = await buildPanelTestApp();
    const owner = await signUp(app);
    const { id: organizationId } = await createPanelOrganization(app, owner);
    await suppressAddresses(app.db, organizationId, [{ address: "bounced@example.org", reason: "hard_bounce" }], null);

    const listed = await app.inject({
      method: "GET",
      url: panel(organizationId, "/suppressions"),
      headers: owner.headers,
    });

    assert.equal(listed.json().data[0].createdBy, null);
  });
});
