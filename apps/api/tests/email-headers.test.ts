import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findInvalidHeaderNames, findReservedHeaders } from "../src/lib/email-headers.ts";

describe("findReservedHeaders", () => {
  it("blocks headers that control routing, identity or MIME structure, in any case", () => {
    assert.deepEqual(
      findReservedHeaders({
        BCC: "x",
        "Reply-To": "x",
        "content-type": "x",
        "Content-Disposition": "x",
        "DKIM-Signature": "x",
        "List-Unsubscribe": "<mailto:u@acme.com>",
        "X-Campaign": "fall",
      }),
      ["BCC", "Reply-To", "content-type", "Content-Disposition", "DKIM-Signature"],
    );
  });
});

describe("findInvalidHeaderNames", () => {
  it("rejects names with control characters, spaces or colons", async () => {
    assert.deepEqual(
      findInvalidHeaderNames({ "X-Ok": "1", "X-Bad\r\nBcc": "1", "X Bad": "1", "X:Bad": "1", "": "1" }),
      ["X-Bad\r\nBcc", "X Bad", "X:Bad", ""],
    );
  });
});
