import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePublicUrl } from "../src/index.ts";

describe("normalizePublicUrl", () => {
  it("accepts https base URLs on registrable domains and normalizes them", () => {
    assert.equal(normalizePublicUrl("https://mail.example.com"), "https://mail.example.com");
    assert.equal(normalizePublicUrl("https://Mail.Example.COM/"), "https://mail.example.com");
    assert.equal(normalizePublicUrl("https://example.com/mail//"), "https://example.com/mail");
    assert.equal(normalizePublicUrl("https://example.com:8443/api"), "https://example.com:8443/api");
    assert.equal(normalizePublicUrl("https://example.com:443"), "https://example.com");
    assert.equal(normalizePublicUrl("https://abc-def.trycloudflare.com"), "https://abc-def.trycloudflare.com");
    assert.equal(normalizePublicUrl("https://abc.ngrok-free.app"), "https://abc.ngrok-free.app");
    assert.equal(normalizePublicUrl("https://bücher.de"), "https://xn--bcher-kva.de");
  });

  it("rejects anything that is not a public https address", () => {
    for (const input of [
      "",
      "mail.example.com",
      "http://mail.example.com",
      "ftp://mail.example.com",
      "https://user:pass@mail.example.com",
      "https://user@mail.example.com",
      "https://mail.example.com/?a=1",
      "https://mail.example.com/?",
      "https://mail.example.com/#frag",
      "https://mail.example.com/a b",
      " https://mail.example.com",
      "https://mail.example.com\r\nX: y",
      "https://localhost",
      "https://localhost:8080",
      "https://api",
      "https://db.internal",
      "https://printer.local",
      "https://127.0.0.1",
      "https://2130706433",
      "https://0x7f.1",
      "https://10.0.0.5",
      "https://169.254.169.254",
      "https://[::1]",
      "https://[fd00::1]",
      "https://8.8.8.8",
      "https://com",
      "https://example.com.",
      `https://example.com/${"a".repeat(2048)}`,
    ]) {
      assert.equal(normalizePublicUrl(input), null, input);
    }
  });
});
