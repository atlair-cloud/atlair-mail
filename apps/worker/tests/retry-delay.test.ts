import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { retryDelaySeconds } from "../src/process-email.ts";
import { retryDelaysSeconds } from "../src/settings.ts";

describe("retryDelaySeconds", () => {
  it("grows per attempt with ±20% jitter and caps at the last step", () => {
    retryDelaysSeconds.forEach((base, index) => {
      const attempt = index + 1;
      assert.equal(retryDelaySeconds(attempt, () => 0), Math.round(base * 0.8));
      assert.equal(retryDelaySeconds(attempt, () => 0.999999), Math.round(base * 1.2));
    });
    assert.equal(retryDelaySeconds(99, () => 0.5), retryDelaysSeconds.at(-1));
  });
});
