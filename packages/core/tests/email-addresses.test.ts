import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMailbox, parseMailbox } from "../src/index.ts";

describe("parseMailbox", () => {
  it("parses bare and named addresses and lowercases the domain", () => {
    assert.deepEqual(parseMailbox("hello@Acme.COM"), { name: null, address: "hello@acme.com", domain: "acme.com" });
    assert.deepEqual(parseMailbox(" Acme Support <help@mail.acme.co.uk> "), {
      name: "Acme Support",
      address: "help@mail.acme.co.uk",
      domain: "mail.acme.co.uk",
    });
    assert.deepEqual(parseMailbox('"Acme, Inc." <hello@acme.com>')?.name, "Acme, Inc.");
    assert.equal(parseMailbox("Müller <info@bücher.de>")?.address, "info@xn--bcher-kva.de");
  });

  it("rejects header injection and anything but exactly one plain mailbox", () => {
    for (const input of [
      "hello@acme.com\r\nBcc: victim@example.org",
      "hello@acme.com\nBcc: victim@example.org",
      "Acme\r\n <hello@acme.com>",
      "hello@acme.com\u0000",
      "a@acme.com, b@acme.com",
      "list: a@acme.com, b@acme.com;",
      '"a b"@acme.com',
      '"a\\"b"@acme.com',
      "hello@[127.0.0.1]",
      "hello@localhost",
      "hello@co.uk",
      "hello@acme.local",
      "@acme.com",
      "hello@",
      "",
      `${"a".repeat(65)}@acme.com`,
      `a@${"b".repeat(320)}.com`,
    ]) {
      assert.equal(parseMailbox(input), null, JSON.stringify(input));
    }
  });

  it("drops comments instead of passing them through", () => {
    assert.equal(parseMailbox("hello(ignored)@acme.com")?.address, "hello@acme.com");
  });
});

describe("formatMailbox", () => {
  it("quotes and escapes display names", () => {
    assert.equal(formatMailbox({ name: null, address: "a@acme.com", domain: "acme.com" }), "a@acme.com");
    assert.equal(
      formatMailbox({ name: 'Acme "Best", Inc\\', address: "a@acme.com", domain: "acme.com" }),
      '"Acme \\"Best\\", Inc\\\\" <a@acme.com>',
    );
  });

  it("round-trips through the parser", () => {
    const parsed = parseMailbox('"Acme, Inc." <hello@acme.com>')!;
    assert.deepEqual(parseMailbox(formatMailbox(parsed)), parsed);
  });
});
