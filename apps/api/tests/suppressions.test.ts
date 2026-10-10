import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { schema } from "@atlair-mail/db";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/service/web/suppressions";
type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

const add = (app: TestApp, token: string, address: string) =>
  app.inject({ method: "POST", url, headers: auth(token), payload: { address } });

const list = (app: TestApp, token: string, query = "") =>
  app.inject({ method: "GET", url: `${url}${query}`, headers: auth(token) });

describe("/service/web/suppressions", { skip: !hasDatabase }, () => {
  it("adds an address once, lists it and removes it, after which sending works again", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);
    const domain = `${uuidv7()}.example.com`;
    await app.db.insert(schema.domains).values({ organizationId, name: domain, status: "verified" });
    const send = () =>
      app.inject({
        method: "POST",
        url: "/service/web/emails",
        headers: auth(token),
        payload: { from: `hello@${domain}`, to: ["ada@example.org"], subject: "Hi", text: "Hi" },
      });

    const created = await add(app, token, "Ada@Example.org");
    const again = await add(app, token, "ada@example.org");
    const blocked = await send();
    const listed = await list(app, token);
    const removed = await app.inject({ method: "DELETE", url: `${url}/${created.json().id}`, headers: auth(token) });
    const removedAgain = await app.inject({
      method: "DELETE",
      url: `${url}/${created.json().id}`,
      headers: auth(token),
    });
    const allowed = await send();

    assert.equal(created.statusCode, 201);
    assert.deepEqual(
      { address: created.json().address, reason: created.json().reason, sourceEmailId: created.json().sourceEmailId },
      { address: "ada@example.org", reason: "manual", sourceEmailId: null },
    );
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().id, created.json().id);
    assert.equal(blocked.statusCode, 422);
    assert.deepEqual(listed.json(), { data: [created.json()], hasMore: false });
    assert.equal(removed.statusCode, 204);
    assert.equal(removedAgain.statusCode, 404);
    assert.equal(allowed.statusCode, 202);
  });

  it("pages oldest first and looks up one address", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    const ids: string[] = [];
    for (const name of ["a", "b", "c"]) ids.push((await add(app, token, `${name}@example.org`)).json().id);

    const first = (await list(app, token, "?limit=2")).json();
    const second = (await list(app, token, `?limit=2&after=${first.data[1].id}`)).json();
    const one = (await list(app, token, "?address=B@example.org")).json();

    assert.deepEqual(first.data.map((row: { id: string }) => row.id), ids.slice(0, 2));
    assert.equal(first.hasMore, true);
    assert.deepEqual(second.data.map((row: { id: string }) => row.id), ids.slice(2));
    assert.equal(second.hasMore, false);
    assert.deepEqual(one.data.map((row: { address: string }) => row.address), ["b@example.org"]);
  });

  it("validates addresses and query parameters", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    for (const address of [
      "not-an-address",
      "Ada <ada@example.org>",
      "a@b.c, d@e.f",
      "ada@example.org\r\nBcc: x@y.z",
    ]) {
      assert.equal((await add(app, token, address)).statusCode, 400, address);
    }
    assert.equal((await list(app, token, "?limit=101")).statusCode, 400);
    assert.equal((await list(app, token, "?after=nope")).statusCode, 400);
    assert.equal((await list(app, token, "?address=nope")).statusCode, 400);
    const smuggled = await app.inject({
      method: "POST",
      url,
      headers: auth(token),
      payload: { address: "a@example.org", reason: "hard_bounce" },
    });
    assert.equal(smuggled.json().reason, "manual");
  });

  it("keeps each organization's list separate and requires a full_access key", async () => {
    const app = await buildTestApp();
    const first = await createTestKey(app);
    const second = await createTestKey(app);
    const sending = await createTestKey(app, { permission: "sending_access" });
    const { id } = (await add(app, first.token, "ada@example.org")).json();

    const otherList = (await list(app, second.token)).json();
    const otherDelete = await app.inject({ method: "DELETE", url: `${url}/${id}`, headers: auth(second.token) });
    const sendingList = await list(app, sending.token);

    assert.deepEqual(otherList, { data: [], hasMore: false });
    assert.equal(otherDelete.statusCode, 404);
    assert.equal(sendingList.statusCode, 403);
    assert.equal((await list(app, first.token)).json().data.length, 1);
  });
});
