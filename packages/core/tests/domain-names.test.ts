import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomainName } from "../src/index.ts";

describe("normalizeDomainName", () => {
  it("normalizes case, whitespace, a trailing dot and unicode", () => {
    assert.equal(normalizeDomainName(" Example.COM. "), "example.com");
    assert.equal(normalizeDomainName("mail.example.co.uk"), "mail.example.co.uk");
    assert.equal(normalizeDomainName("bücher.de"), "xn--bcher-kva.de");
  });

  it("rejects anything that is not a registrable public domain", () => {
    for (const input of [
      "",
      "co.uk",
      "com",
      "localhost",
      "example.local",
      "127.0.0.1",
      "[::1]",
      "exa_mple.com",
      "a..b.com",
      "-bad.com",
      "*.example.com",
      "example.com/path",
      "https://example.com",
      "user@example.com",
      "example.com:25",
      `${"a".repeat(64)}.com`,
      `${"a.".repeat(127)}com`,
    ]) {
      assert.equal(normalizeDomainName(input), null, input);
    }
  });
});
