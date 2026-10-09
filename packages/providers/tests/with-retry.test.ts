import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ProviderRejectedError,
  ProviderThrottledError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  withRetry,
  type RetryEvent,
} from "../src/index.ts";
import { createFakeProvider } from "../src/testing.ts";

const message = { from: { address: "a@example.com" }, to: [{ address: "b@example.org" }], subject: "s", text: "t" };
const fast = { minTimeout: 1, maxTimeout: 4 };

const failing = (...errors: Error[]) => {
  let call = 0;
  return async () => {
    const error = errors[call++];
    if (error) throw error;
    return { providerMessageId: "sent" };
  };
};

describe("withRetry", () => {
  it("retries throttling and unavailability, then succeeds", async () => {
    const fake = createFakeProvider({ send: failing(new ProviderThrottledError(), new ProviderUnavailableError()) });

    const result = await withRetry(fake, fast).send(message);

    assert.deepEqual(result, { providerMessageId: "sent" });
    assert.equal(fake.calls.length, 3);
  });

  it("gives up after the retry budget and throws the last error", async () => {
    const fake = createFakeProvider({ send: failing(...Array.from({ length: 5 }, () => new ProviderUnavailableError())) });

    await assert.rejects(withRetry(fake, { ...fast, retries: 2 }).send(message), ProviderUnavailableError);
    assert.equal(fake.calls.length, 3);
  });

  it("never retries a permanent rejection", async () => {
    const fake = createFakeProvider({ send: failing(new ProviderRejectedError("MessageRejected")) });

    await assert.rejects(withRetry(fake, fast).send(message), ProviderRejectedError);
    assert.equal(fake.calls.length, 1);
  });

  it("never repeats a send whose outcome is unknown", async () => {
    const fake = createFakeProvider({ send: failing(new ProviderTimeoutError()) });

    await assert.rejects(withRetry(fake, fast).send(message), ProviderTimeoutError);
    assert.equal(fake.calls.length, 1);
  });

  it("retries timeouts on idempotent operations", async () => {
    let calls = 0;
    const fake = createFakeProvider({
      getDomain: async () => {
        if (calls++ === 0) throw new ProviderTimeoutError();
        return { status: "verified", dnsRecords: [] };
      },
    });

    assert.equal((await withRetry(fake, fast).getDomain("example.com"))?.status, "verified");
    assert.equal(fake.calls.length, 2);
  });

  it("does not retry errors that are not provider errors", async () => {
    const fake = createFakeProvider({ send: failing(new TypeError("bug")) });

    await assert.rejects(withRetry(fake, fast).send(message), TypeError);
    assert.equal(fake.calls.length, 1);
  });

  it("backs off exponentially with jitter inside the configured bounds", async () => {
    const events: RetryEvent[] = [];
    const fake = createFakeProvider({
      send: failing(...Array.from({ length: 4 }, () => new ProviderThrottledError())),
    });
    const retrying = withRetry(fake, {
      retries: 4,
      minTimeout: 10,
      maxTimeout: 30,
      onRetry: (event) => events.push(event),
    });

    await retrying.send(message);

    assert.deepEqual(
      events.map((event) => [event.operation, event.attempt]),
      [
        ["send", 1],
        ["send", 2],
        ["send", 3],
        ["send", 4],
      ],
    );
    const [first, second, ...rest] = events.map((event) => event.delayMs);
    assert.ok(first! >= 10 && first! <= 20, `first delay ${first}`);
    assert.ok(second! >= 20 && second! <= 30, `second delay ${second}`);
    assert.ok(rest.every((delay) => delay <= 30), `capped delays ${rest}`);
  });

  it("keeps the EmailProvider shape", async () => {
    const wrapped = withRetry(withRetry(createFakeProvider(), fast), fast);

    assert.equal(wrapped.type, "ses");
    assert.deepEqual(Object.keys(wrapped).sort(), ["configureReturnPath", "createDomain", "getDomain", "send", "type", "verifyAccount"]);
    assert.equal((await wrapped.verifyAccount()).sendingEnabled, true);
  });
});
