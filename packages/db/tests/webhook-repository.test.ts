import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  claimDueWebhookDeliveries,
  countWebhookEndpoints,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  enqueueWebhookDeliveries,
  findWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  recordWebhookAttempt,
  updateWebhookEndpoint,
} from "../src/index.ts";
import { emailEvents, emails, webhookDeliveries, webhookEndpoints } from "../src/schema/index.ts";
import type { EmailEventType, WebhookPayload } from "../src/types.ts";
import { CHECK_VIOLATION, databaseUrl, newEmail, pgError, useTestDb } from "./helpers.ts";

describe("webhook repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  const endpoint = (organizationId: string, eventTypes: EmailEventType[] = ["delivered"], disabledAt: Date | null = null) =>
    createWebhookEndpoint(t.db, {
      organizationId,
      url: "https://example.org/hooks",
      eventTypes,
      signingSecretEncrypted: "ciphertext",
      encryptionKeyVersion: 1,
      disabledAt,
    });

  async function emailEvent(organizationId: string, type: EmailEventType = "delivered") {
    const domain = await t.newDomain(organizationId);
    const [email] = await t.db.insert(emails).values(newEmail(organizationId, domain.id)).returning();
    const [event] = await t.db
      .insert(emailEvents)
      .values({
        emailId: email!.id,
        type,
        providerEventId: uuidv7(),
        occurredAt: new Date(),
        payload: { recipients: [{ address: "user@example.org" }] },
      })
      .returning();
    return event!;
  }

  const payload = (emailId: string): WebhookPayload => ({
    type: "email.delivered",
    createdAt: new Date().toISOString(),
    data: { emailId, from: "a@example.com", to: ["user@example.org"], subject: "Hi", recipients: [] },
  });

  const request = async (organizationId: string, type: EmailEventType = "delivered") => {
    const event = await emailEvent(organizationId, type);
    return { organizationId, emailEventId: event.id, eventType: type, payload: payload(event.emailId) };
  };

  const makeDue = (ids: string[]) =>
    t.db
      .update(webhookDeliveries)
      .set({ nextAttemptAt: sql`now() - interval '1 second'` })
      .where(inArray(webhookDeliveries.id, ids));

  const claimOwn = async (ids: string[], limit = 100) =>
    (await claimDueWebhookDeliveries(t.db, { limit, leaseSeconds: 60 })).filter((row) => ids.includes(row.id));

  test("rejects unknown event types", async () => {
    const organization = await t.newOrganization();

    await assert.rejects(endpoint(organization.id, ["exploded" as EmailEventType]), pgError(CHECK_VIOLATION));
  });

  test("endpoints are only visible and changeable inside their organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const created = await endpoint(organization.id);

    assert.equal(await findWebhookEndpoint(t.db, other.id, created.id), null);
    assert.equal(await updateWebhookEndpoint(t.db, other.id, created.id, { url: "https://evil.example" }), null);
    assert.equal(await deleteWebhookEndpoint(t.db, other.id, created.id), null);
    assert.equal((await listWebhookEndpoints(t.db, other.id)).length, 0);
    assert.equal(await countWebhookEndpoints(t.db, organization.id), 1);

    const updated = await updateWebhookEndpoint(t.db, organization.id, created.id, { eventTypes: ["bounced"] });
    assert.deepEqual(updated?.eventTypes, ["bounced"]);
    assert.deepEqual(await deleteWebhookEndpoint(t.db, organization.id, created.id), { id: created.id });
    assert.equal(await findWebhookEndpoint(t.db, organization.id, created.id), null);
  });

  test("queues an event once for each enabled, subscribed endpoint in the organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const subscribed = await endpoint(organization.id, ["delivered", "bounced"]);
    await endpoint(organization.id, ["bounced"]);
    await endpoint(organization.id, ["delivered"], new Date());
    await endpoint(other.id, ["delivered"]);
    const delivered = await request(organization.id);

    const queued = await enqueueWebhookDeliveries(t.db, delivered);
    const repeat = await enqueueWebhookDeliveries(t.db, delivered);

    assert.equal(queued.length, 1);
    assert.equal(repeat.length, 0);
    const [row] = await t.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, queued[0]!.id));
    assert.equal(row?.webhookEndpointId, subscribed.id);
    assert.equal(row?.status, "pending");
    assert.deepEqual(row?.payload, delivered.payload);
  });

  test("a claim leases a delivery, and an expired lease makes it due again", async () => {
    const organization = await t.newOrganization();
    const created = await endpoint(organization.id);
    const queued = await enqueueWebhookDeliveries(t.db, await request(organization.id));
    const ids = queued.map((row) => row.id);

    const [claimed] = await claimOwn(ids);
    const again = await claimOwn(ids);
    await makeDue(ids);
    const [reclaimed] = await claimOwn(ids);

    assert.equal(claimed?.attempt, 1);
    assert.equal(claimed?.endpoint.id, created.id);
    assert.equal(claimed?.endpoint.signingSecretEncrypted, "ciphertext");
    assert.equal(again.length, 0);
    assert.equal(reclaimed?.attempt, 2);
  });

  test("concurrent claims never hand out the same delivery", async () => {
    const organization = await t.newOrganization();
    await endpoint(organization.id);
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(...(await enqueueWebhookDeliveries(t.db, await request(organization.id))).map((row) => row.id));
    }

    const batches = await Promise.all([claimOwn(ids, 3), claimOwn(ids, 3), claimOwn(ids, 3)]);
    const claimed = batches.flat().map((row) => row.id);

    assert.equal(new Set(claimed).size, claimed.length);
  });

  test("records an attempt only for the current claim", async () => {
    const organization = await t.newOrganization();
    await endpoint(organization.id);
    const ids = (await enqueueWebhookDeliveries(t.db, await request(organization.id))).map((row) => row.id);
    const [first] = await claimOwn(ids);
    await makeDue(ids);
    const [second] = await claimOwn(ids);
    assert.ok(first && second);

    const stale = await recordWebhookAttempt(t.db, {
      id: first.id,
      attempt: first.attempt,
      status: "delivered",
      responseStatus: 200,
      error: null,
    });
    const current = await recordWebhookAttempt(t.db, {
      id: second.id,
      attempt: second.attempt,
      status: "delivered",
      responseStatus: 204,
      error: null,
    });
    const late = await recordWebhookAttempt(t.db, {
      id: second.id,
      attempt: second.attempt,
      status: "failed",
      responseStatus: 500,
      error: "late",
    });

    assert.equal(stale, null);
    assert.deepEqual(current, { id: second.id, status: "delivered" });
    assert.equal(late, null);
    const [row] = await t.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, second.id));
    assert.equal(row?.lastResponseStatus, 204);
    assert.ok(row?.deliveredAt);
  });

  test("a retry waits until its next attempt time", async () => {
    const organization = await t.newOrganization();
    await endpoint(organization.id);
    const ids = (await enqueueWebhookDeliveries(t.db, await request(organization.id))).map((row) => row.id);
    const [claimed] = await claimOwn(ids);
    assert.ok(claimed);

    await recordWebhookAttempt(t.db, {
      id: claimed.id,
      attempt: claimed.attempt,
      status: "pending",
      nextAttemptAt: new Date(Date.now() + 60_000),
      responseStatus: 503,
      error: "ATL_WEBHOOK_HTTP_ERROR",
    });

    assert.equal((await claimOwn(ids)).length, 0);
    await makeDue(ids);
    assert.equal((await claimOwn(ids))[0]?.attempt, 2);
  });

  test("lists an endpoint's deliveries newest first, only for its organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const created = await endpoint(organization.id);
    for (let i = 0; i < 3; i++) await enqueueWebhookDeliveries(t.db, await request(organization.id));
    await delay(5);

    const page = await listWebhookDeliveries(t.db, {
      organizationId: organization.id,
      webhookEndpointId: created.id,
      limit: 2,
    });
    const rest = await listWebhookDeliveries(t.db, {
      organizationId: organization.id,
      webhookEndpointId: created.id,
      before: page.at(-1)!.id,
      limit: 2,
    });
    const foreign = await listWebhookDeliveries(t.db, {
      organizationId: other.id,
      webhookEndpointId: created.id,
      limit: 10,
    });

    assert.equal(page.length, 2);
    assert.ok(page[0]!.id > page[1]!.id);
    assert.equal(rest.length, 1);
    assert.equal(foreign.length, 0);
  });

  test("deleting an endpoint removes its deliveries", async () => {
    const organization = await t.newOrganization();
    const created = await endpoint(organization.id);
    const ids = (await enqueueWebhookDeliveries(t.db, await request(organization.id))).map((row) => row.id);

    await deleteWebhookEndpoint(t.db, organization.id, created.id);

    assert.equal((await t.db.select().from(webhookDeliveries).where(inArray(webhookDeliveries.id, ids))).length, 0);
    assert.equal(
      (await t.db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, created.id))).length,
      0,
    );
  });
});
