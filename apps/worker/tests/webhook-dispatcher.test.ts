import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { Webhook } from "standardwebhooks";
import { v7 as uuidv7 } from "uuid";
import { createCredentialsCipher } from "@atlair-mail/core";
import {
  claimDueWebhookDeliveries,
  enqueueWebhookDeliveries,
  rotateWebhookSigningSecret,
  schema,
  type WebhookPayload,
} from "@atlair-mail/db";
import {
  createWebhookDispatcher,
  deliverWebhook,
  webhookRetryDelaySeconds,
} from "../src/webhook-dispatcher.ts";
import { maxWebhookAttempts, webhookErrorCodes, webhookRetryDelaysSeconds } from "../src/settings.ts";
import type { WebhookRequest, WebhookResponse, WebhookSender } from "../src/webhook-sender.ts";
import { databaseUrl, silentLogger, useWorkerTestDb, waitFor } from "./helpers.ts";

const cipher = createCredentialsCipher(`1:${Buffer.alloc(32, 7).toString("base64")}`);
const secret = `whsec_${Buffer.alloc(32, 9).toString("base64")}`;
const nextSecret = `whsec_${Buffer.alloc(32, 5).toString("base64")}`;

function recordingSender(respond: (request: WebhookRequest) => WebhookResponse = () => ({ ok: true, status: 200 })) {
  const requests: WebhookRequest[] = [];
  const send: WebhookSender = async (request) => {
    requests.push(request);
    return respond(request);
  };
  return { requests, send };
}

describe("webhook dispatcher", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  async function queuedDelivery(options: { disabled?: boolean } = {}) {
    const from = await t.sender();
    const [emailId] = await t.queue(from);
    const encrypted = await cipher.encrypt(secret, from.organizationId);
    const [endpoint] = await t.db
      .insert(schema.webhookEndpoints)
      .values({
        organizationId: from.organizationId,
        url: "https://hooks.example.com/in",
        eventTypes: ["delivered"],
        signingSecretEncrypted: encrypted.ciphertext,
        encryptionKeyVersion: encrypted.keyVersion,
      })
      .returning();
    const [event] = await t.db
      .insert(schema.emailEvents)
      .values({
        emailId: emailId!,
        type: "delivered",
        providerEventId: uuidv7(),
        occurredAt: new Date("2026-10-09T10:00:00.000Z"),
        payload: { recipients: [{ address: "ada@example.org" }] },
      })
      .returning();
    const payload: WebhookPayload = {
      type: "email.delivered",
      createdAt: "2026-10-09T10:00:00.000Z",
      data: {
        emailId: emailId!,
        from: `hello@${from.domain}`,
        to: ["ada@example.org"],
        subject: "Welcome",
        recipients: [{ address: "ada@example.org" }],
      },
    };
    const [queued] = await enqueueWebhookDeliveries(t.db, {
      organizationId: from.organizationId,
      emailEventId: event!.id,
      eventType: "delivered",
      payload,
    });
    if (options.disabled) {
      await t.db
        .update(schema.webhookEndpoints)
        .set({ disabledAt: new Date() })
        .where(eq(schema.webhookEndpoints.id, endpoint!.id));
    }
    return { id: queued!.id, payload, endpointId: endpoint!.id, organizationId: from.organizationId };
  }

  const read = async (id: string) =>
    (await t.db.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, id)))[0]!;

  const makeDue = (id: string) =>
    t.db
      .update(schema.webhookDeliveries)
      .set({ nextAttemptAt: sql`now() - interval '1 second'` })
      .where(eq(schema.webhookDeliveries.id, id));

  const claimOwn = async (id: string) =>
    (await claimDueWebhookDeliveries(t.db, { limit: 100, leaseSeconds: 60 })).find((row) => row.id === id);

  const start = (send: WebhookSender) => {
    const dispatcher = createWebhookDispatcher({ db: t.db, logger: silentLogger, cipher, send, pollIntervalMs: 20 });
    dispatcher.start();
    return dispatcher;
  };

  it("delivers a delivery committed while no dispatcher was running", async () => {
    const delivery = await queuedDelivery();
    const { requests, send } = recordingSender();

    const dispatcher = start(send);
    await waitFor(async () => (await read(delivery.id)).status === "delivered");
    await dispatcher.stop();

    const row = await read(delivery.id);
    assert.equal(row.attemptCount, 1);
    assert.equal(row.lastResponseStatus, 200);
    assert.ok(row.deliveredAt);
    assert.equal(requests.filter((request) => request.headers["webhook-id"] === delivery.id).length, 1);
  });

  it("delivers after a dispatcher crashed holding the claim, once the lease ends", async () => {
    const delivery = await queuedDelivery();
    const crashed = await claimOwn(delivery.id);
    assert.equal(crashed?.attempt, 1);
    await makeDue(delivery.id);
    const { send } = recordingSender();

    const dispatcher = start(send);
    await waitFor(async () => (await read(delivery.id)).status === "delivered");
    await dispatcher.stop();

    assert.equal((await read(delivery.id)).attemptCount, 2);
  });

  it("signs each request so the receiver can verify it with the endpoint secret", async () => {
    const delivery = await queuedDelivery();
    const claimed = await claimOwn(delivery.id);
    const { requests, send } = recordingSender();
    const now = new Date();

    await deliverWebhook(claimed!, { db: t.db, logger: silentLogger, cipher, send, now: () => now });

    const [request] = requests;
    assert.equal(request?.url, "https://hooks.example.com/in");
    assert.equal(request?.headers["webhook-id"], delivery.id);
    assert.equal(request?.headers["webhook-timestamp"], String(Math.floor(now.getTime() / 1000)));
    assert.deepEqual(new Webhook(secret).verify(request!.body, request!.headers), delivery.payload);
    assert.throws(() => new Webhook(`whsec_${Buffer.alloc(32, 1).toString("base64")}`).verify(request!.body, request!.headers));
    assert.throws(() =>
      new Webhook(secret).verify(request!.body.replace("Welcome", "Hacked"), request!.headers),
    );
  });

  const rotate = async (delivery: { endpointId: string; organizationId: string }, overlapSeconds = 3_600) => {
    const encrypted = await cipher.encrypt(nextSecret, delivery.organizationId);
    return rotateWebhookSigningSecret(t.db, delivery.organizationId, delivery.endpointId, {
      ciphertext: encrypted.ciphertext,
      keyVersion: encrypted.keyVersion,
      overlapSeconds,
    });
  };

  it("signs with both secrets during a rotation overlap, so either one verifies", async () => {
    const delivery = await queuedDelivery();
    await rotate(delivery);
    const claimed = await claimOwn(delivery.id);
    const { requests, send } = recordingSender();

    await deliverWebhook(claimed!, { db: t.db, logger: silentLogger, cipher, send });

    const [request] = requests;
    assert.equal(request!.headers["webhook-signature"]!.split(" ").length, 2);
    assert.match(request!.headers["webhook-signature"]!, /^v1,\S+ v1,\S+$/);
    assert.deepEqual(new Webhook(nextSecret).verify(request!.body, request!.headers), delivery.payload);
    assert.deepEqual(new Webhook(secret).verify(request!.body, request!.headers), delivery.payload);
  });

  it("signs with the new secret only once the overlap has ended", async () => {
    const delivery = await queuedDelivery();
    const rotated = await rotate(delivery);
    const claimed = await claimOwn(delivery.id);
    const { requests, send } = recordingSender();
    const after = new Date(rotated!.previousSecretExpiresAt!.getTime() + 1_000);

    await deliverWebhook(claimed!, { db: t.db, logger: silentLogger, cipher, send, now: () => after });

    const signature = requests[0]!.headers["webhook-signature"];
    assert.equal(signature, new Webhook(nextSecret).sign(delivery.id, after, requests[0]!.body));
    assert.ok(!signature!.includes(new Webhook(secret).sign(delivery.id, after, requests[0]!.body)));
  });

  it("still delivers, signed with the new secret, when the previous one cannot be decrypted", async () => {
    const delivery = await queuedDelivery();
    await rotate(delivery);
    await t.db
      .update(schema.webhookEndpoints)
      .set({ previousSigningSecretEncrypted: "not-a-ciphertext" })
      .where(eq(schema.webhookEndpoints.id, delivery.endpointId));
    const claimed = await claimOwn(delivery.id);
    const { requests, send } = recordingSender();

    const outcome = await deliverWebhook(claimed!, { db: t.db, logger: silentLogger, cipher, send });

    assert.equal(outcome, "delivered");
    assert.deepEqual(new Webhook(nextSecret).verify(requests[0]!.body, requests[0]!.headers), delivery.payload);
    assert.throws(() => new Webhook(secret).verify(requests[0]!.body, requests[0]!.headers));
  });

  it("clears expired previous secrets while it runs", async () => {
    const delivery = await queuedDelivery();
    await rotate(delivery);
    await t.db
      .update(schema.webhookEndpoints)
      .set({ previousSecretExpiresAt: sql`now() - interval '1 second'` })
      .where(eq(schema.webhookEndpoints.id, delivery.endpointId));
    const endpoint = async () =>
      (await t.db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, delivery.endpointId)))[0]!;

    const dispatcher = start(recordingSender().send);
    await waitFor(async () => (await endpoint()).previousSigningSecretEncrypted === null);
    await dispatcher.stop();

    const row = await endpoint();
    assert.equal(row.previousEncryptionKeyVersion, null);
    assert.equal(row.previousSecretExpiresAt, null);
  });

  it("retries on the backoff schedule and dead-letters after the last attempt", async () => {
    const delivery = await queuedDelivery();
    const { requests, send } = recordingSender(() => ({ ok: false, status: 503, error: webhookErrorCodes.httpError }));
    const outcomes: string[] = [];

    for (let attempt = 1; attempt <= maxWebhookAttempts; attempt++) {
      await makeDue(delivery.id);
      const claimed = await claimOwn(delivery.id);
      assert.equal(claimed?.attempt, attempt);
      const now = new Date();
      outcomes.push(await deliverWebhook(claimed!, { db: t.db, logger: silentLogger, cipher, send, now: () => now }));
      const row = await read(delivery.id);
      if (attempt < maxWebhookAttempts) {
        assert.equal(row.nextAttemptAt.getTime() - now.getTime(), webhookRetryDelaySeconds(attempt) * 1000);
      }
    }
    await makeDue(delivery.id);

    const row = await read(delivery.id);
    assert.equal(maxWebhookAttempts, 8);
    assert.deepEqual(outcomes, [...Array(7).fill("retrying"), "failed"]);
    assert.equal(row.status, "failed");
    assert.equal(row.attemptCount, maxWebhookAttempts);
    assert.equal(row.lastResponseStatus, 503);
    assert.equal(row.lastError, webhookErrorCodes.httpError);
    assert.equal(await claimOwn(delivery.id), undefined);
    assert.equal(requests.length, maxWebhookAttempts);
    assert.deepEqual(
      Array.from({ length: 7 }, (_, index) => webhookRetryDelaySeconds(index + 1)),
      [...webhookRetryDelaysSeconds],
    );
  });

  it("fails deliveries for a disabled endpoint without calling it", async () => {
    const delivery = await queuedDelivery({ disabled: true });
    const claimed = await claimOwn(delivery.id);
    const { requests, send } = recordingSender();

    const outcome = await deliverWebhook(claimed!, { db: t.db, logger: silentLogger, cipher, send });

    const row = await read(delivery.id);
    assert.equal(outcome, "failed");
    assert.equal(row.status, "failed");
    assert.equal(row.lastError, webhookErrorCodes.endpointDisabled);
    assert.equal(requests.length, 0);
  });

  it("lets in-flight deliveries finish on stop", async () => {
    const delivery = await queuedDelivery();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const send: WebhookSender = async () => {
      await gate;
      return { ok: true, status: 200 };
    };
    const dispatcher = start(send);
    await waitFor(async () => dispatcher.inFlight > 0 || (await read(delivery.id)).attemptCount > 0);

    const stopping = dispatcher.stop();
    release();
    await stopping;

    assert.equal((await read(delivery.id)).status, "delivered");
  });
});
