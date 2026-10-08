import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProviderRejectedError } from "../src/index.ts";
import { createFakeProvider } from "../src/testing.ts";

describe("fake provider", () => {
  it("records calls and returns defaults or overrides", async () => {
    const fake = createFakeProvider({
      getDomain: async () => {
        throw new ProviderRejectedError("NotAllowed");
      },
    });

    const first = await fake.send({ from: { address: "a@example.com" }, to: [{ address: "b@example.org" }], subject: "s", text: "t" });
    const second = await fake.send({ from: { address: "a@example.com" }, to: [{ address: "b@example.org" }], subject: "s", text: "t" });
    await assert.rejects(fake.getDomain("example.com"), ProviderRejectedError);

    assert.notEqual(first.providerMessageId, second.providerMessageId);
    assert.deepEqual(
      fake.calls.map((call) => call.operation),
      ["send", "send", "getDomain"],
    );
    assert.deepEqual(fake.calls[2]!.args, ["example.com"]);
  });
});
