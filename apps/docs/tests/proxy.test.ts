import { strict as assert } from "node:assert";
import { test } from "node:test";
import { proxyTarget } from "../src/proxy.ts";

const server = "https://api.atlair.cloud/mail";
const through = (target: string) => `https://docs.atlair.cloud/proxy?scalar_url=${encodeURIComponent(target)}`;

test("allows the public API", () => {
  assert.equal(proxyTarget(through(`${server}/service/web/emails?limit=5`), server)?.toString(), `${server}/service/web/emails?limit=5`);
});

test("refuses everything else", () => {
  for (const target of [
    "https://example.com/service/web/emails",
    "http://api.atlair.cloud/mail/service/web/emails",
    `${server}/service/panel/me`,
    `${server}/service/web/../panel/me`,
    `${server}/service/web/%2e%2e/panel/me`,
    `${server}/docs/openapi.json`,
    "https://api.atlair.cloud.evil.com/mail/service/web/emails",
    "not a url",
  ]) {
    assert.equal(proxyTarget(through(target), server), null, target);
  }
  assert.equal(proxyTarget("https://docs.atlair.cloud/proxy", server), null);
});
