import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.ts";

describe("GET /health", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  before(async () => {
    app = await buildApp({ env: { LOG_LEVEL: "silent" } });
    await app.ready();
  });

  after(() => app.close());

  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, "ok");
  });
});
