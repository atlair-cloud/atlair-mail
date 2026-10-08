import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailStatuses } from "@atlair-mail/db/types";
import { canTransition, emailTransitions, isTerminal } from "../src/index.ts";

describe("email status transitions", () => {
  it("covers every status", () => {
    assert.deepEqual(Object.keys(emailTransitions).sort(), [...emailStatuses].sort());
  });

  it("allows the send lifecycle", () => {
    assert.ok(canTransition("queued", "sending"));
    assert.ok(canTransition("sending", "sent"));
    assert.ok(canTransition("sending", "queued"));
    assert.ok(canTransition("sent", "delivered"));
    assert.ok(canTransition("delivered", "bounced"));
    assert.ok(canTransition("delivered", "complained"));
    assert.ok(canTransition("queued", "canceled"));
  });

  it("rejects moves backwards or out of a final state", () => {
    assert.ok(!canTransition("delivered", "sending"));
    assert.ok(!canTransition("sent", "queued"));
    assert.ok(!canTransition("sending", "canceled"));
    assert.ok(!canTransition("queued", "sent"));
    for (const status of ["bounced", "complained", "failed", "canceled"] as const) {
      assert.ok(isTerminal(status));
      for (const next of emailStatuses) assert.ok(!canTransition(status, next));
    }
  });

  it("never transitions a status to itself", () => {
    for (const status of emailStatuses) assert.ok(!canTransition(status, status));
  });
});
