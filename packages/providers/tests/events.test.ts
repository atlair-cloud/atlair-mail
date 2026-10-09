import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boundEventDetails, eventLimits, providerEventKey } from "../src/index.ts";

const parts = {
  providerMessageId: "0100-abc",
  type: "bounced" as const,
  occurredAt: new Date("2026-10-09T10:00:00.000Z"),
  recipients: [{ address: "B@example.org" }, { address: "a@example.org" }],
};

describe("providerEventKey", () => {
  it("is stable across recipient order and case", () => {
    const reordered = { ...parts, recipients: [{ address: "a@example.org" }, { address: "b@example.org" }] };
    assert.equal(providerEventKey(parts), providerEventKey(reordered));
    assert.match(providerEventKey(parts), /^[0-9a-f]{64}$/);
  });

  it("differs when any part differs", () => {
    const key = providerEventKey(parts);
    assert.notEqual(providerEventKey({ ...parts, type: "delivered" }), key);
    assert.notEqual(providerEventKey({ ...parts, providerMessageId: "0100-abd" }), key);
    assert.notEqual(providerEventKey({ ...parts, occurredAt: new Date("2026-10-09T10:00:00.001Z") }), key);
    assert.notEqual(providerEventKey({ ...parts, recipients: [{ address: "a@example.org" }] }), key);
  });

  it("cannot be confused by delimiters inside values", () => {
    const left = providerEventKey({ ...parts, providerMessageId: 'a","b' });
    const right = providerEventKey({ ...parts, providerMessageId: "a", recipients: [{ address: 'b","' }] });
    assert.notEqual(left, right);
  });
});

describe("boundEventDetails", () => {
  it("caps sizes and strips control characters", () => {
    const bounded = boundEventDetails({
      recipients: Array.from({ length: 80 }, (_, index) => ({
        address: `user${index}@example.org\r\nBcc: x@evil.test`,
        diagnosticCode: "5.1.1 ".repeat(500),
      })),
      bounce: { kind: "permanent", subType: "General".repeat(20) },
      complaint: { feedbackType: "abuse\u0000" },
      smtpResponse: "250 OK\u0007",
      link: `https://example.org/${"a".repeat(5000)}`,
    });

    assert.equal(bounded.recipients.length, eventLimits.recipients);
    assert.equal(bounded.recipients[0]?.address, "user0@example.orgBcc: x@evil.test");
    assert.equal(bounded.recipients[0]?.diagnosticCode?.length, eventLimits.text);
    assert.equal(bounded.bounce?.subType.length, eventLimits.name);
    assert.deepEqual(bounded.complaint, { feedbackType: "abuse" });
    assert.equal(bounded.smtpResponse, "250 OK");
    assert.equal(bounded.link?.length, eventLimits.link);
  });

  it("keeps absent fields absent", () => {
    assert.deepEqual(boundEventDetails({ recipients: [{ address: "a@example.org" }] }), {
      recipients: [{ address: "a@example.org" }],
    });
    assert.deepEqual(boundEventDetails({ recipients: [], complaint: {} }), { recipients: [], complaint: {} });
  });
});
