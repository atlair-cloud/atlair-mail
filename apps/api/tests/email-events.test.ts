import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { schema } from "@atlair-mail/db";
import {
  providerEventKey,
  type EmailEventDetails,
  type EmailEventType,
  type ProviderEvent,
} from "@atlair-mail/providers";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";
import { rejectedByProvider } from "../src/services/email-events.ts";

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

async function sentEmail(app: TestApp, values: Partial<typeof schema.emails.$inferInsert> = {}) {
  const key = await createTestKey(app);
  const [domain] = await app.db
    .insert(schema.domains)
    .values({ organizationId: key.organizationId, name: `${uuidv7()}.example.com`, status: "verified" })
    .returning();
  const [email] = await app.db
    .insert(schema.emails)
    .values({
      organizationId: key.organizationId,
      domainId: domain!.id,
      fromAddress: `hello@${domain!.name}`,
      toAddresses: ["ada@example.org", "bob@example.org"],
      subject: "Welcome",
      textBody: "Hi",
      status: "sent",
      providerMessageId: uuidv7(),
      ...values,
    })
    .returning();
  return { ...key, email: email! };
}

function providerEvent(
  providerMessageId: string,
  type: EmailEventType,
  details: Partial<EmailEventDetails> = {},
  occurredAt = new Date("2026-10-09T10:00:00.000Z"),
): ProviderEvent {
  const recipients = details.recipients ?? [{ address: "ada@example.org" }];
  return {
    eventKey: providerEventKey({ providerMessageId, type, occurredAt, recipients }),
    providerMessageId,
    type,
    occurredAt,
    details: { ...details, recipients },
  };
}

const statusOf = async (app: TestApp, id: string) =>
  (await app.db.select().from(schema.emails).where(eq(schema.emails.id, id)))[0]!;

describe("recording provider events", { skip: !hasDatabase }, () => {
  it("applies an event once and ignores the repeat", async () => {
    const app = await buildTestApp();
    const { organizationId, email } = await sentEmail(app);
    const delivered = providerEvent(email.providerMessageId!, "delivered", { smtpResponse: "250 OK" });

    const first = await app.services.emailEvents.record(organizationId, delivered);
    const repeat = await app.services.emailEvents.record(organizationId, delivered);

    assert.deepEqual(first, { outcome: "applied", emailId: email.id });
    assert.deepEqual(repeat, { outcome: "duplicate", emailId: email.id });
    assert.equal((await statusOf(app, email.id)).status, "delivered");
    assert.equal((await app.services.emailEvents.list(organizationId, email.id))?.length, 1);
  });

  it("ends on the most severe outcome whatever order events arrive in", async () => {
    const app = await buildTestApp();
    const { organizationId, email } = await sentEmail(app);
    const id = email.providerMessageId!;
    const record = (event: ProviderEvent) => app.services.emailEvents.record(organizationId, event);

    await record(providerEvent(id, "complained", { complaint: { feedbackType: "abuse" } }));
    const late = await record(providerEvent(id, "delivered", { recipients: [{ address: "bob@example.org" }] }));
    const bounce = await record(
      providerEvent(id, "bounced", {
        recipients: [{ address: "bob@example.org", diagnosticCode: "smtp; 550 5.1.1 user unknown" }],
        bounce: { kind: "permanent", subType: "General" },
      }),
    );

    assert.equal(late.outcome, "recorded");
    assert.equal(bounce.outcome, "recorded");
    assert.equal((await statusOf(app, email.id)).status, "complained");
  });

  it("records transient bounces, delays and engagement without changing status", async () => {
    const app = await buildTestApp();
    const { organizationId, email } = await sentEmail(app);
    const id = email.providerMessageId!;

    const outcomes = await Promise.all([
      app.services.emailEvents.record(
        organizationId,
        providerEvent(id, "bounced", { bounce: { kind: "transient", subType: "MailboxFull" } }),
      ),
      app.services.emailEvents.record(organizationId, providerEvent(id, "delivery_delayed")),
      app.services.emailEvents.record(organizationId, providerEvent(id, "opened")),
    ]);

    assert.deepEqual(
      outcomes.map((result) => result.outcome),
      ["recorded", "recorded", "recorded"],
    );
    assert.equal((await statusOf(app, email.id)).status, "sent");
  });

  it("settles an email the worker had not confirmed, found by its id tag", async () => {
    const app = await buildTestApp();
    const { organizationId, email } = await sentEmail(app, {
      status: "failed",
      providerMessageId: null,
      lastError: "ATL_WORKER_LEASE_EXPIRED",
    });
    const providerMessageId = uuidv7();

    const result = await app.services.emailEvents.record(organizationId, {
      ...providerEvent(providerMessageId, "delivered"),
      emailId: email.id,
    });

    const settled = await statusOf(app, email.id);
    assert.equal(result.outcome, "applied");
    assert.equal(settled.status, "delivered");
    assert.equal(settled.providerMessageId, providerMessageId);
    assert.equal(settled.lastError, null);
  });

  it("marks a provider rejection as failed", async () => {
    const app = await buildTestApp();
    const { organizationId, email } = await sentEmail(app);

    await app.services.emailEvents.record(organizationId, providerEvent(email.providerMessageId!, "rejected"));

    const failed = await statusOf(app, email.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.lastError, rejectedByProvider);
  });

  it("never touches another organization's email", async () => {
    const app = await buildTestApp();
    const { email } = await sentEmail(app);
    const other = await createTestKey(app);

    const result = await app.services.emailEvents.record(other.organizationId, {
      ...providerEvent(email.providerMessageId!, "bounced", { bounce: { kind: "permanent", subType: "General" } }),
      emailId: email.id,
    });

    assert.deepEqual(result, { outcome: "not_found", emailId: null });
    assert.equal((await statusOf(app, email.id)).status, "sent");
  });

  it("stores bounded details only", async () => {
    const app = await buildTestApp();
    const { organizationId, email } = await sentEmail(app);

    await app.services.emailEvents.record(
      organizationId,
      providerEvent(email.providerMessageId!, "bounced", {
        recipients: [{ address: "ada@example.org", diagnosticCode: `550\r\n${"x".repeat(5000)}` }],
        bounce: { kind: "permanent", subType: "General" },
      }),
    );

    const [event] = (await app.services.emailEvents.list(organizationId, email.id))!;
    const code = event!.details.recipients[0]!.diagnosticCode!;
    assert.equal(code.length, 1000);
    assert.doesNotMatch(code, /[\r\n]/);
  });
});

describe("GET /v1/emails/:id/events", { skip: !hasDatabase }, () => {
  it("returns the timeline oldest first with per-recipient detail", async () => {
    const app = await buildTestApp();
    const { organizationId, token, email } = await sentEmail(app);
    const id = email.providerMessageId!;
    await app.services.emailEvents.record(
      organizationId,
      providerEvent(
        id,
        "bounced",
        {
          recipients: [{ address: "bob@example.org", diagnosticCode: "smtp; 550 5.1.1 user unknown" }],
          bounce: { kind: "permanent", subType: "General" },
        },
        new Date("2026-10-09T10:00:05.000Z"),
      ),
    );
    await app.services.emailEvents.record(
      organizationId,
      providerEvent(id, "delivered", { smtpResponse: "250 2.0.0 OK" }, new Date("2026-10-09T10:00:01.000Z")),
    );

    const res = await app.inject({ method: "GET", url: `/v1/emails/${email.id}/events`, headers: auth(token) });
    const { data } = res.json();

    assert.equal(res.statusCode, 200);
    assert.deepEqual(
      data.map((event: { type: string }) => event.type),
      ["delivered", "bounced"],
    );
    assert.deepEqual(data[0], {
      id: data[0].id,
      type: "delivered",
      occurredAt: "2026-10-09T10:00:01.000Z",
      recipients: [{ address: "ada@example.org" }],
      smtpResponse: "250 2.0.0 OK",
    });
    assert.deepEqual(data[1].bounce, { kind: "permanent", subType: "General" });
    assert.equal(data[1].recipients[0].diagnosticCode, "smtp; 550 5.1.1 user unknown");
  });

  it("returns an empty list before any event, and 404 across organizations or for unknown ids", async () => {
    const app = await buildTestApp();
    const { token, email } = await sentEmail(app);
    const other = await createTestKey(app);

    const empty = await app.inject({ method: "GET", url: `/v1/emails/${email.id}/events`, headers: auth(token) });
    const crossOrg = await app.inject({
      method: "GET",
      url: `/v1/emails/${email.id}/events`,
      headers: auth(other.token),
    });
    const sendingKey = await createTestKey(app, { permission: "sending_access" });
    const unknown = await app.inject({
      method: "GET",
      url: `/v1/emails/${uuidv7()}/events`,
      headers: auth(sendingKey.token),
    });

    assert.deepEqual(empty.json(), { data: [] });
    assert.equal(crossOrg.statusCode, 404);
    assert.equal(unknown.statusCode, 404);
  });
});
