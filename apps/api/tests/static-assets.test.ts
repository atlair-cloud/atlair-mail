import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.ts";

describe("static assets", () => {
  it("serves the social icons so email clients on other origins can load them", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ url: "/assets/social/github-dark.png" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["content-type"], "image/png");
    assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
    assert.match(String(res.headers["cache-control"]), /max-age=604800/);
    await app.close();
  });

  it("serves only PNGs from the assets folder", async () => {
    const app = await buildTestApp();
    for (const url of ["/assets/social/LICENSE", "/assets/../package.json", "/assets/", "/assets/social/"]) {
      assert.equal((await app.inject({ url })).statusCode, 404, url);
    }
    await app.close();
  });
});
