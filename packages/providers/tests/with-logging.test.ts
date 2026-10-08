import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProviderRejectedError, withLogging, type ProviderLogger } from "../src/index.ts";
import { createFakeProvider } from "../src/testing.ts";

const message = {
  from: { name: "Ada", address: "ada@example.com" },
  to: [{ address: "grace@example.org" }],
  cc: [{ address: "linus@example.org" }],
  bcc: [{ address: "audit@example.com" }],
  replyTo: [{ address: "support@example.com" }],
  subject: "Quarterly salary review",
  html: "<p>Confidential body</p>",
  text: "Confidential body",
  headers: { "X-Customer": "secret-customer-ref" },
};

function captureLogger() {
  const entries: { level: "info" | "warn"; fields: Record<string, unknown>; message: string }[] = [];
  const logger: ProviderLogger = {
    info: (fields, text) => entries.push({ level: "info", fields: fields as Record<string, unknown>, message: text }),
    warn: (fields, text) => entries.push({ level: "warn", fields: fields as Record<string, unknown>, message: text }),
  };
  return { logger, entries };
}

describe("withLogging", () => {
  it("logs one line per call with duration and outcome, and passes the result through", async () => {
    const { logger, entries } = captureLogger();

    const result = await withLogging(createFakeProvider(), logger).send(message);

    assert.deepEqual(result, { providerMessageId: "fake-1" });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.level, "info");
    assert.equal(entries[0]!.fields.provider, "ses");
    assert.equal(entries[0]!.fields.operation, "send");
    assert.equal(entries[0]!.fields.outcome, "ok");
    assert.equal(entries[0]!.fields.recipientCount, 3);
    assert.equal(entries[0]!.fields.providerMessageId, "fake-1");
    assert.equal(typeof entries[0]!.fields.durationMs, "number");
  });

  it("logs failures as warnings and rethrows the same error", async () => {
    const { logger, entries } = captureLogger();
    const rejection = new ProviderRejectedError("MessageRejected");
    const fake = createFakeProvider({
      send: async () => {
        throw rejection;
      },
    });

    await assert.rejects(withLogging(fake, logger).send(message), (error) => error === rejection);

    assert.equal(entries[0]!.level, "warn");
    assert.equal(entries[0]!.fields.errorCode, "ATL_PROVIDER_REJECTED");
    assert.equal(entries[0]!.fields.retryable, false);
  });

  it("never logs addresses, subject, body, headers or error messages", async () => {
    const { logger, entries } = captureLogger();
    const fake = createFakeProvider({
      send: async () => {
        throw new ProviderRejectedError("MessageRejected", { cause: new Error("grace@example.org is not verified") });
      },
    });
    const logged = withLogging(fake, logger);

    await assert.rejects(logged.send(message));
    await withLogging(createFakeProvider(), logger).send(message);
    const text = JSON.stringify(entries);

    for (const sensitive of [
      "ada@example.com",
      "grace@example.org",
      "linus@example.org",
      "audit@example.com",
      "support@example.com",
      "Quarterly salary review",
      "Confidential body",
      "secret-customer-ref",
      "is not verified",
    ]) {
      assert.ok(!text.includes(sensitive), `logged ${sensitive}`);
    }
  });

  it("logs domain operations with the domain and resulting status", async () => {
    const { logger, entries } = captureLogger();

    await withLogging(createFakeProvider(), logger).createDomain("example.com");

    assert.deepEqual(
      { domain: entries[0]!.fields.domain, status: entries[0]!.fields.status },
      { domain: "example.com", status: "pending" },
    );
  });
});
