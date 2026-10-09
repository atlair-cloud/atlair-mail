import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { emailStatuses, type EmailStatus } from "@atlair-mail/db/types";
import { bounceKinds, emailEventTypes } from "@atlair-mail/providers/types";
import {
  canTransition,
  emailTransitions,
  isTerminal,
  statusForEvent,
  transitionSources,
  type StatusEvent,
} from "../src/index.ts";

const apply = (status: EmailStatus, event: StatusEvent) => {
  const next = statusForEvent(event);
  return next && canTransition(status, next) ? next : status;
};

const statusEvent = fc.record(
  { type: fc.constantFrom(...emailEventTypes), bounce: fc.record({ kind: fc.constantFrom(...bounceKinds) }) },
  { requiredKeys: ["type"] },
);

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
    assert.ok(canTransition("bounced", "complained"));
    assert.ok(canTransition("queued", "canceled"));
  });

  it("lets provider evidence settle an email the worker could not confirm", () => {
    for (const from of ["sending", "failed"] as const) {
      for (const to of ["delivered", "bounced", "complained"] as const) assert.ok(canTransition(from, to));
    }
    assert.ok(!canTransition("failed", "sent"));
    assert.ok(!canTransition("failed", "queued"));
  });

  it("rejects moves backwards or out of a final state", () => {
    assert.ok(!canTransition("delivered", "sending"));
    assert.ok(!canTransition("delivered", "sent"));
    assert.ok(!canTransition("bounced", "delivered"));
    assert.ok(!canTransition("complained", "bounced"));
    assert.ok(!canTransition("sent", "queued"));
    assert.ok(!canTransition("sending", "canceled"));
    assert.ok(!canTransition("queued", "sent"));
    for (const status of ["complained", "canceled"] as const) {
      assert.ok(isTerminal(status));
      for (const next of emailStatuses) assert.ok(!canTransition(status, next));
    }
  });

  it("never transitions a status to itself", () => {
    for (const status of emailStatuses) assert.ok(!canTransition(status, status));
  });

  it("lists the statuses that may move to a target", () => {
    assert.deepEqual(transitionSources("delivered").sort(), ["failed", "sending", "sent"]);
    assert.deepEqual(transitionSources("complained").sort(), ["bounced", "delivered", "failed", "sending", "sent"]);
    assert.deepEqual(transitionSources("queued"), ["sending"]);
  });
});

describe("statusForEvent", () => {
  it("maps provider events to statuses", () => {
    assert.equal(statusForEvent({ type: "sent" }), "sent");
    assert.equal(statusForEvent({ type: "delivered" }), "delivered");
    assert.equal(statusForEvent({ type: "bounced", bounce: { kind: "permanent" } }), "bounced");
    assert.equal(statusForEvent({ type: "bounced", bounce: { kind: "undetermined" } }), "bounced");
    assert.equal(statusForEvent({ type: "complained" }), "complained");
    assert.equal(statusForEvent({ type: "rejected" }), "failed");
  });

  it("records transient bounces, delays and engagement without changing status", () => {
    assert.equal(statusForEvent({ type: "bounced", bounce: { kind: "transient" } }), null);
    assert.equal(statusForEvent({ type: "delivery_delayed" }), null);
    assert.equal(statusForEvent({ type: "opened" }), null);
    assert.equal(statusForEvent({ type: "clicked" }), null);
  });

  it("reaches the same status whatever order the events arrive in", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EmailStatus>("sending", "sent"),
        fc
          .array(statusEvent, { maxLength: 8 })
          .chain((events) =>
            fc.tuple(fc.constant(events), fc.shuffledSubarray(events, { minLength: events.length })),
          ),
        (start, [events, shuffled]) => {
          assert.equal(shuffled.reduce(apply, start), events.reduce(apply, start));
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("ignores a repeated event", () => {
    fc.assert(
      fc.property(fc.constantFrom(...emailStatuses), statusEvent, (start, event) => {
        const once = apply(start, event);
        assert.equal(apply(once, event), once);
      }),
    );
  });
});
