import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { emailStatuses } from "@atlair-mail/db/types";
import { bounceKinds, emailEventTypes } from "@atlair-mail/providers/types";
import {
  canSettleFromEvents,
  canTransition,
  emailTransitions,
  recipientOutcomes,
  statusFromEvents,
  suppressionsFromEvent,
  type OutcomeEvent,
} from "../src/index.ts";

const event = (type: OutcomeEvent["type"], addresses: string[], extra: Partial<OutcomeEvent["details"]> = {}) => ({
  type,
  details: { recipients: addresses.map((address) => ({ address })), ...extra },
});

const simulatorRun: OutcomeEvent[] = [
  event("sent", [
    "success@simulator.amazonses.com",
    "bounce@simulator.amazonses.com",
    "complaint@simulator.amazonses.com",
    "ooto@simulator.amazonses.com",
    "suppressionlist@simulator.amazonses.com",
  ]),
  event("complained", ["complaint@simulator.amazonses.com"], { complaint: { feedbackType: "abuse" } }),
  event("bounced", ["ooto@simulator.amazonses.com"], { bounce: { kind: "transient", subType: "General" } }),
  event("bounced", ["bounce@simulator.amazonses.com", "suppressionlist@simulator.amazonses.com"], {
    bounce: { kind: "permanent", subType: "General" },
  }),
  event("delivered", [
    "success@simulator.amazonses.com",
    "complaint@simulator.amazonses.com",
    "ooto@simulator.amazonses.com",
  ]),
];

const addresses = ["ada@example.org", "bob@example.org", "cy@example.org"];

const outcomeEvent: fc.Arbitrary<OutcomeEvent> = fc.record({
  type: fc.constantFrom(...emailEventTypes),
  details: fc.record(
    {
      recipients: fc.subarray(addresses, { minLength: 1 }).map((list) => list.map((address) => ({ address }))),
      bounce: fc.record({ kind: fc.constantFrom(...bounceKinds), subType: fc.constant("General") }),
      complaint: fc.record({ feedbackType: fc.constantFrom("abuse", "not-spam", "fraud") }),
    },
    { requiredKeys: ["recipients"] },
  ),
});

describe("worker transitions", () => {
  it("covers every status and only the worker's moves", () => {
    assert.deepEqual(Object.keys(emailTransitions).sort(), [...emailStatuses].sort());
    assert.ok(canTransition("queued", "sending"));
    assert.ok(canTransition("sending", "sent"));
    assert.ok(canTransition("sending", "queued"));
    assert.ok(canTransition("queued", "canceled"));
    assert.ok(!canTransition("sent", "queued"));
    assert.ok(!canTransition("sending", "canceled"));
    for (const status of emailStatuses) assert.ok(!canTransition(status, status));
  });

  it("lets provider events settle only emails the provider may have seen", () => {
    assert.deepEqual(
      emailStatuses.filter(canSettleFromEvents),
      ["sending", "sent", "delivered", "bounced", "complained", "failed"],
    );
  });
});

describe("recipientOutcomes", () => {
  it("resolves the live simulator run per recipient", () => {
    assert.deepEqual(Object.fromEntries(recipientOutcomes(simulatorRun)), {
      "success@simulator.amazonses.com": "delivered",
      "bounce@simulator.amazonses.com": "bounced",
      "complaint@simulator.amazonses.com": "complained",
      "ooto@simulator.amazonses.com": "delivered",
      "suppressionlist@simulator.amazonses.com": "bounced",
    });
  });

  it("treats an out-of-office reply as delivered, and a transient bounce alone as bounced", () => {
    const transient = event("bounced", ["ada@example.org"], { bounce: { kind: "transient", subType: "General" } });

    assert.equal(statusFromEvents([transient, event("delivered", ["ada@example.org"])]), "delivered");
    assert.equal(statusFromEvents([event("delivered", ["ada@example.org"]), transient]), "delivered");
    assert.equal(statusFromEvents([event("sent", ["ada@example.org"]), transient]), "bounced");
  });

  it("matches recipients case-insensitively", () => {
    const outcomes = recipientOutcomes([
      event("delivered", ["Ada@Example.org"]),
      event("complained", ["ada@example.org"], { complaint: { feedbackType: "abuse" } }),
    ]);

    assert.deepEqual(Object.fromEntries(outcomes), { "ada@example.org": "complained" });
  });
});

describe("statusFromEvents", () => {
  it("is the most severe recipient outcome", () => {
    assert.equal(statusFromEvents(simulatorRun), "complained");
    assert.equal(statusFromEvents(simulatorRun.slice(0, 1)), "sent");
    assert.equal(statusFromEvents([event("sent", addresses), event("delivered", ["ada@example.org"])]), "delivered");
    assert.equal(
      statusFromEvents([
        event("delivered", ["ada@example.org"]),
        event("bounced", ["bob@example.org"], { bounce: { kind: "undetermined", subType: "Undetermined" } }),
      ]),
      "bounced",
    );
  });

  it("fails on a rejection and ignores delays, opens, clicks and not-spam reports", () => {
    assert.equal(statusFromEvents([event("sent", addresses), event("rejected", addresses)]), "failed");
    assert.equal(statusFromEvents([event("delivery_delayed", addresses), event("opened", addresses)]), null);
    assert.equal(
      statusFromEvents([
        event("delivered", addresses),
        event("complained", addresses, { complaint: { feedbackType: "not-spam" } }),
      ]),
      "delivered",
    );
  });

  it("does not depend on the order or repetition of events", () => {
    fc.assert(
      fc.property(
        fc
          .array(outcomeEvent, { maxLength: 10 })
          .chain((events) =>
            fc.tuple(fc.constant(events), fc.shuffledSubarray(events, { minLength: events.length })),
          ),
        ([events, shuffled]) => {
          assert.equal(statusFromEvents(shuffled), statusFromEvents(events));
          assert.equal(statusFromEvents([...events, ...events]), statusFromEvents(events));
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe("suppressionsFromEvent", () => {
  it("suppresses permanent bounces and complaints only", () => {
    const [, complained, outOfOffice, bounced, delivered] = simulatorRun;

    assert.deepEqual(suppressionsFromEvent(bounced!), [
      { address: "bounce@simulator.amazonses.com", reason: "hard_bounce" },
      { address: "suppressionlist@simulator.amazonses.com", reason: "hard_bounce" },
    ]);
    assert.deepEqual(suppressionsFromEvent(complained!), [
      { address: "complaint@simulator.amazonses.com", reason: "complaint" },
    ]);
    assert.deepEqual(suppressionsFromEvent(outOfOffice!), []);
    assert.deepEqual(suppressionsFromEvent(delivered!), []);
  });

  it("skips undetermined bounces, not-spam reports and malformed addresses", () => {
    const permanent = { bounce: { kind: "permanent" as const, subType: "General" } };

    assert.deepEqual(
      suppressionsFromEvent(
        event("bounced", ["ada@example.org"], { bounce: { kind: "undetermined", subType: "Undetermined" } }),
      ),
      [],
    );
    assert.deepEqual(
      suppressionsFromEvent(event("complained", ["ada@example.org"], { complaint: { feedbackType: "not-spam" } })),
      [],
    );
    assert.deepEqual(
      suppressionsFromEvent(
        event(
          "bounced",
          [" Ada@Example.ORG ", "ada@example.org", "no-at-sign", "a b@example.org", `${"x".repeat(320)}@e.org`],
          permanent,
        ),
      ),
      [{ address: "ada@example.org", reason: "hard_bounce" }],
    );
  });

  it("suppresses a complaint without a feedback type", () => {
    assert.deepEqual(suppressionsFromEvent(event("complained", ["ada@example.org"], { complaint: {} })), [
      { address: "ada@example.org", reason: "complaint" },
    ]);
  });
});
