import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { webhookPayload } from "../src/index.ts";

describe("webhookPayload", () => {
  it("names the event and carries the email summary and event details", () => {
    const payload = webhookPayload(
      { id: "e1", fromAddress: "Acme <hi@acme.com>", toAddresses: ["ada@example.org"], subject: "Hi" },
      {
        type: "failed",
        occurredAt: new Date("2026-10-09T10:00:00.000Z"),
        details: { recipients: [], error: "ATL_RECIPIENT_SUPPRESSED" },
      },
    );

    assert.deepEqual(payload, {
      type: "email.failed",
      createdAt: "2026-10-09T10:00:00.000Z",
      data: {
        emailId: "e1",
        from: "Acme <hi@acme.com>",
        to: ["ada@example.org"],
        subject: "Hi",
        recipients: [],
        error: "ATL_RECIPIENT_SUPPRESSED",
      },
    });
  });
});
