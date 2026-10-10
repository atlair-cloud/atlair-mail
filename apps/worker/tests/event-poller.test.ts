import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { createCredentialsCipher, handleProviderMessage } from "@atlair-mail/core";
import { claimDueEventPolls, schema } from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import { ProviderRejectedError, type EmailProvider, type EventMessage } from "@atlair-mail/providers";
import { createFakeProvider, createSnsTestSigner } from "@atlair-mail/providers/testing";
import { createEventPoller, eventPollBackoffMs, pollConnection, type EventPollerOptions } from "../src/event-poller.ts";
import { databaseUrl, silentLogger, useWorkerTestDb, waitFor } from "./helpers.ts";

const account = "123456789012";
const cipher = createCredentialsCipher(`1:${Buffer.alloc(32, 7).toString("base64")}`);
const sign = createSnsTestSigner("ap-south-1");

function fakeQueue() {
  const messages = new Map<string, { body: unknown; receiveCount: number }>();
  const deleted: string[] = [];
  let receiving = 0;
  let maxConcurrentReceives = 0;
  const provider = createFakeProvider({
    receiveEventMessages: async (): Promise<EventMessage[]> => {
      receiving++;
      maxConcurrentReceives = Math.max(maxConcurrentReceives, receiving);
      await new Promise((resolve) => setTimeout(resolve, 5));
      receiving--;
      return [...messages].map(([id, message]) => {
        message.receiveCount++;
        return { id, receipt: `${id}#${message.receiveCount}`, body: message.body, receiveCount: message.receiveCount };
      });
    },
    deleteEventMessages: async (receipts) => {
      for (const receipt of receipts) {
        const id = receipt.split("#")[0]!;
        messages.delete(id);
        deleted.push(id);
      }
      return { failed: [] };
    },
    getEventQueueStats: async () => ({ backlog: messages.size, deadLetters: 0 }),
  });
  return {
    provider,
    deleted,
    messages,
    add(body: unknown) {
      const id = uuidv7();
      messages.set(id, { body, receiveCount: 0 });
      return id;
    },
    get maxConcurrentReceives() {
      return maxConcurrentReceives;
    },
  };
}

describe("provider event poller", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  async function pullConnection(mode: "pull" | "push" = "pull") {
    const from = await t.sender();
    const providerMessageId = uuidv7();
    const [emailId] = await t.queue(from, 1, { status: "sent", providerMessageId });
    const topicArn = `arn:aws:sns:ap-south-1:${account}:atlair-mail-events-${uuidv7()}`;
    const { ciphertext, keyVersion } = await cipher.encrypt(JSON.stringify({ secretAccessKey: "s" }), from.organizationId);
    const [connection] = await t.db
      .insert(schema.providerConnections)
      .values({
        organizationId: from.organizationId,
        provider: "ses",
        settings: {
          region: "ap-south-1",
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          eventTopicArn: topicArn,
          eventQueueUrl: "https://sqs.ap-south-1.amazonaws.com/123456789012/q",
          eventDeadLetterQueueUrl: "https://sqs.ap-south-1.amazonaws.com/123456789012/q-dlq",
        },
        credentialsEncrypted: ciphertext,
        encryptionKeyVersion: keyVersion,
        eventsMode: mode,
        eventsUrl: mode === "push" ? "https://mail.example.com" : null,
        eventsConfirmedAt: new Date(),
        eventsPollAfter: sql`now() - interval '1 second'`,
      })
      .returning();
    return { connection: connection!, topicArn, providerMessageId, emailId: emailId! };
  }

  const delivered = (topicArn: string, providerMessageId: string, at = "2026-10-09T10:00:02.000Z") =>
    sign({
      Type: "Notification",
      TopicArn: topicArn,
      Message: JSON.stringify({
        eventType: "Delivery",
        mail: {
          timestamp: "2026-10-09T10:00:00.000Z",
          messageId: providerMessageId,
          sendingAccountId: account,
          destination: ["ada@example.org"],
        },
        delivery: { timestamp: at, recipients: ["ada@example.org"], smtpResponse: "250 OK" },
      }),
    });

  const claim = async (connectionId: string): Promise<ProviderConnection> => {
    const claimed = (await claimDueEventPolls(t.db, { limit: 1000, leaseUntil: new Date(Date.now() + 120_000) })).find(
      (row) => row.id === connectionId,
    );
    assert.ok(claimed, "connection was not due");
    return claimed;
  };

  const options = (provider: EmailProvider, extra: Partial<EventPollerOptions> = {}): EventPollerOptions => ({
    db: t.db,
    logger: silentLogger,
    cipher,
    providerFor: async () => provider,
    ...extra,
  });

  const readConnection = async (id: string) =>
    (await t.db.select().from(schema.providerConnections).where(eq(schema.providerConnections.id, id)))[0]!;

  const makeDue = (id: string) =>
    t.db
      .update(schema.providerConnections)
      .set({ eventsPollAfter: sql`now() - interval '1 second'` })
      .where(eq(schema.providerConnections.id, id));

  const eventsOf = (emailId: string) =>
    t.db.select().from(schema.emailEvents).where(eq(schema.emailEvents.emailId, emailId));

  it("records a pulled event, then deletes the message", async () => {
    const { connection, topicArn, providerMessageId, emailId } = await pullConnection();
    const queue = fakeQueue();
    const id = queue.add(delivered(topicArn, providerMessageId));

    const outcome = await pollConnection(await claim(connection.id), options(queue.provider), new AbortController().signal);

    assert.deepEqual(outcome, { received: 1, deleted: 1, kept: 0, error: null, stopped: false });
    assert.deepEqual(queue.deleted, [id]);
    assert.equal((await t.read(emailId)).status, "delivered");
    const after = await readConnection(connection.id);
    assert.ok(after.eventsLastReceivedAt);
    assert.ok(after.eventsPollAfter && after.eventsPollAfter.getTime() <= Date.now() + 1_000);
  });

  it("only deletes after the event is committed, and a redelivery is recorded once", async () => {
    const { connection, topicArn, providerMessageId, emailId } = await pullConnection();
    const queue = fakeQueue();
    queue.add(delivered(topicArn, providerMessageId));
    const failing = createFakeProvider({
      receiveEventMessages: queue.provider.receiveEventMessages,
      deleteEventMessages: async () => {
        throw new ProviderRejectedError("NetworkGone");
      },
    });

    const crashed = await pollConnection(await claim(connection.id), options(failing), new AbortController().signal);
    await makeDue(connection.id);
    const retried = await pollConnection(await claim(connection.id), options(queue.provider), new AbortController().signal);

    assert.equal(crashed.error, "ATL_PROVIDER_REJECTED: NetworkGone");
    assert.equal(queue.messages.size, 0);
    assert.deepEqual(retried, { received: 1, deleted: 1, kept: 0, error: null, stopped: false });
    assert.equal((await eventsOf(emailId)).length, 1);
  });

  it("leaves unverifiable or failing messages in the queue and handles the rest", async () => {
    const { connection, topicArn, providerMessageId, emailId } = await pullConnection();
    const other = await pullConnection();
    const queue = fakeQueue();
    const good = queue.add(delivered(topicArn, providerMessageId));
    const foreign = queue.add(delivered(other.topicArn, providerMessageId));
    const tampered = queue.add({ ...delivered(topicArn, providerMessageId, "2026-10-09T10:00:09.000Z"), Message: "{}" });
    const unparsable = queue.add(null);
    const crashing = queue.add(delivered(topicArn, providerMessageId, "2026-10-09T10:00:05.000Z"));
    const handleMessage: EventPollerOptions["handleMessage"] = async (context, conn, body) => {
      if ((body as { MessageId?: string } | null)?.MessageId === (queue.messages.get(crashing)?.body as { MessageId: string }).MessageId) {
        throw new Error("database went away");
      }
      return handleProviderMessage(context, conn, "pull", body);
    };

    const outcome = await pollConnection(
      await claim(connection.id),
      options(queue.provider, { handleMessage }),
      new AbortController().signal,
    );

    assert.deepEqual(outcome, { received: 5, deleted: 1, kept: 4, error: null, stopped: false });
    assert.deepEqual(queue.deleted, [good]);
    assert.deepEqual([...queue.messages.keys()].sort(), [foreign, tampered, unparsable, crashing].sort());
    assert.equal((await eventsOf(emailId)).length, 1);
  });

  it("deletes events for unknown emails and harmless message types", async () => {
    const { connection, topicArn } = await pullConnection();
    const queue = fakeQueue();
    queue.add(delivered(topicArn, uuidv7()));
    queue.add(
      sign({
        Type: "UnsubscribeConfirmation",
        TopicArn: topicArn,
        Token: "t",
        Message: "bye",
        SubscribeURL: "https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription",
      }),
    );

    const outcome = await pollConnection(await claim(connection.id), options(queue.provider), new AbortController().signal);

    assert.equal(outcome.deleted, 2);
    assert.equal(queue.messages.size, 0);
  });

  it("confirms a subscription that arrives in the queue and removes the push subscription", async () => {
    const { connection, topicArn } = await pullConnection();
    const queue = fakeQueue();
    queue.add(sign({ Type: "SubscriptionConfirmation", TopicArn: topicArn, Token: "token-9", Message: "subscribe" }));

    const outcome = await pollConnection(await claim(connection.id), options(queue.provider), new AbortController().signal);

    const subscriptionCalls = queue.provider.calls
      .filter((call) => call.operation === "confirmEvents" || call.operation === "removeEventSubscriptions")
      .map((call) => [call.operation, call.args]);
    assert.deepEqual(subscriptionCalls, [
      ["confirmEvents", ["token-9"]],
      ["removeEventSubscriptions", [connection.id, "push"]],
    ]);
    assert.equal(outcome.deleted, 1);
  });

  it("backs off after queue errors and resets after a success", async () => {
    const { connection } = await pullConnection();
    const denied = createFakeProvider({
      receiveEventMessages: async () => {
        throw new ProviderRejectedError("AccessDenied");
      },
    });

    const started = Date.now();
    await pollConnection(await claim(connection.id), options(denied), new AbortController().signal);
    const first = await readConnection(connection.id);
    await makeDue(connection.id);
    await pollConnection(await claim(connection.id), options(denied), new AbortController().signal);
    const second = await readConnection(connection.id);
    await makeDue(connection.id);
    await pollConnection(await claim(connection.id), options(fakeQueue().provider), new AbortController().signal);
    const recovered = await readConnection(connection.id);

    assert.equal(first.eventsFailures, 1);
    assert.equal(first.eventsLastError, "ATL_PROVIDER_REJECTED: AccessDenied");
    assert.ok(first.eventsPollAfter!.getTime() >= started + eventPollBackoffMs(1) - 1_000);
    assert.equal(second.eventsFailures, 2);
    assert.ok(second.eventsPollAfter!.getTime() - first.eventsPollAfter!.getTime() > 0);
    assert.equal(eventPollBackoffMs(1), 30_000);
    assert.equal(eventPollBackoffMs(2), 60_000);
    assert.equal(eventPollBackoffMs(20), 900_000);
    assert.equal(recovered.eventsFailures, 0);
    assert.equal(recovered.eventsLastError, null);
  });

  it("keeps draining after switching to push until the queue is empty", async () => {
    const { connection, topicArn, providerMessageId } = await pullConnection("push");
    const queue = fakeQueue();
    queue.add(delivered(topicArn, providerMessageId));

    const first = await pollConnection(await claim(connection.id), options(queue.provider), new AbortController().signal);
    await makeDue(connection.id);
    const second = await pollConnection(await claim(connection.id), options(queue.provider), new AbortController().signal);

    assert.equal(first.stopped, false);
    assert.equal(second.stopped, true);
    assert.equal((await readConnection(connection.id)).eventsPollAfter, null);
  });

  it("never polls one connection from two pollers at once, and stops promptly", async () => {
    const { connection, topicArn, providerMessageId, emailId } = await pullConnection();
    const queue = fakeQueue();
    queue.add(delivered(topicArn, providerMessageId));
    const pollers = [1, 2].map(() =>
      createEventPoller({ ...options(queue.provider), idle: { minMs: 10, maxMs: 10 }, waitSeconds: 0 }),
    );

    for (const poller of pollers) poller.start();
    await waitFor(async () => (await t.read(emailId)).status === "delivered");
    await Promise.all(pollers.map((poller) => poller.stop()));

    assert.equal(queue.maxConcurrentReceives, 1);
    assert.equal((await eventsOf(emailId)).length, 1);
    assert.ok((await readConnection(connection.id)).eventsPollAfter);
  });

  it("aborts a long poll on shutdown without counting a failure", async () => {
    const { connection } = await pullConnection();
    const waiting = createFakeProvider({
      receiveEventMessages: ({ signal }) =>
        new Promise((_, reject) => {
          if (signal?.aborted) return reject(new Error("AbortError"));
          signal?.addEventListener("abort", () => reject(new Error("AbortError")));
        }),
    });
    const controller = new AbortController();

    const polling = pollConnection(await claim(connection.id), options(waiting), controller.signal);
    setTimeout(() => controller.abort(), 20);
    const outcome = await polling;
    const stoppedEarly = new AbortController();
    stoppedEarly.abort();
    await makeDue(connection.id);
    const skipped = await pollConnection(await claim(connection.id), options(waiting), stoppedEarly.signal);

    assert.equal(outcome.error, null);
    assert.equal(skipped.received, 0);
    assert.equal(waiting.calls.filter((call) => call.operation === "receiveEventMessages").length, 1);
    const after = await readConnection(connection.id);
    assert.equal(after.eventsFailures, 0);
    assert.ok(after.eventsPollAfter!.getTime() <= Date.now() + 1_000);
  });
});
