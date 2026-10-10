import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { schema, type DomainStatus, type EmailStatus } from "@atlair-mail/db";
import {
  addPanelMember,
  buildPanelTestApp,
  createPanelOrganization,
  hasDatabase,
  signUp,
} from "./helpers.ts";

type TestApp = Awaited<ReturnType<typeof buildPanelTestApp>>;

const overviewUrl = (organizationId: string) => `/service/panel/organizations/${organizationId}/overview`;

async function setUpOrganization(app: TestApp) {
  const owner = await signUp(app);
  const organization = await createPanelOrganization(app, owner);
  return { owner, organizationId: organization.id };
}

async function connectProvider(app: TestApp, organizationId: string, events: boolean) {
  await app.db.insert(schema.providerConnections).values({
    organizationId,
    provider: "ses",
    settings: { region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" },
    credentialsEncrypted: "ciphertext",
    encryptionKeyVersion: 1,
    eventsMode: events ? "pull" : null,
    eventsConfirmedAt: events ? new Date() : null,
  });
}

async function addDomain(app: TestApp, organizationId: string, status: DomainStatus) {
  const [domain] = await app.db
    .insert(schema.domains)
    .values({ organizationId, name: `${uuidv7()}.example.com`, status })
    .returning();
  return domain!;
}

async function addEmails(app: TestApp, organizationId: string, domainId: string, statuses: EmailStatus[], createdAt = new Date()) {
  if (statuses.length === 0) return [];
  return app.db
    .insert(schema.emails)
    .values(
      statuses.map((status) => ({
        organizationId,
        domainId,
        fromAddress: "hello@example.com",
        toAddresses: ["ada@example.org"],
        subject: `Email ${status}`,
        textBody: "Hi",
        status,
        createdAt,
      })),
    )
    .returning();
}

const repeat = <T>(value: T, times: number): T[] => Array(times).fill(value);

describe("panel overview", { skip: !hasDatabase }, () => {
  it("starts in setup with every step open", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await setUpOrganization(app);

    const res = await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: owner.headers });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.health, "setup");
    assert.deepEqual(body.setup.provider, { connected: false, provider: null, region: null, eventsConnected: false });
    assert.deepEqual(body.setup.domains, { total: 0, verified: 0, pending: 0, failed: 0 });
    assert.equal(body.setup.apiKeys, 0);
    assert.equal(body.setup.members, 1);
    assert.equal(body.setup.firstEmailSent, false);
    assert.equal(body.metrics.daily.length, 7);
    assert.equal(body.metrics.last7d.total, 0);
    assert.deepEqual(body.metrics.rates, { delivery: null, bounce: null, complaint: null });
    assert.deepEqual(body.attention, []);
    assert.deepEqual(body.recentEmails, []);
  });

  it("reports healthy sending with counts, rates and recent emails", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await setUpOrganization(app);
    await connectProvider(app, organizationId, true);
    const domain = await addDomain(app, organizationId, "verified");
    await addEmails(app, organizationId, domain.id, [...repeat<EmailStatus>("delivered", 98), "bounced", "queued"]);
    await addEmails(app, organizationId, domain.id, ["delivered"], new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));

    const body = (await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: owner.headers })).json();

    assert.equal(body.health, "ok");
    assert.deepEqual(body.setup.provider, { connected: true, provider: "ses", region: "eu-west-1", eventsConnected: true });
    assert.equal(body.setup.firstEmailSent, true);
    assert.equal(body.metrics.last24h.total, 100);
    assert.equal(body.metrics.last24h.delivered, 98);
    assert.equal(body.metrics.last7d.total, 101);
    assert.equal(body.metrics.rates.delivery, 99 / 100);
    assert.equal(body.metrics.rates.bounce, 1 / 100);
    assert.equal(body.metrics.daily.at(-1).counts.total, 100);
    assert.equal(body.metrics.daily.reduce((sum: number, entry: { counts: { total: number } }) => sum + entry.counts.total, 0), 101);
    assert.equal(body.recentEmails.length, 10);
    assert.deepEqual(body.domains.map((entry: { name: string }) => entry.name), [domain.name]);
    assert.deepEqual(body.attention, []);
  });

  it("raises a critical bounce rate and puts it first", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await setUpOrganization(app);
    await connectProvider(app, organizationId, true);
    const domain = await addDomain(app, organizationId, "verified");
    await addEmails(app, organizationId, domain.id, [...repeat<EmailStatus>("delivered", 90), ...repeat<EmailStatus>("bounced", 10), "failed"]);

    const body = (await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: owner.headers })).json();

    assert.equal(body.health, "critical");
    assert.equal(body.attention[0].kind, "bounce_rate");
    assert.equal(body.attention[0].severity, "critical");
    assert.match(body.attention[0].title, /10\.0%/);
    assert.ok(body.attention.some((item: { kind: string }) => item.kind === "emails_failed"));
  });

  it("ignores rates below the minimum volume", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await setUpOrganization(app);
    await connectProvider(app, organizationId, true);
    const domain = await addDomain(app, organizationId, "verified");
    await addEmails(app, organizationId, domain.id, ["delivered", "bounced"]);

    const body = (await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: owner.headers })).json();

    assert.equal(body.metrics.rates.bounce, 0.5);
    assert.equal(body.health, "ok");
  });

  it("flags failed domains, unconnected events and failing webhooks", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await setUpOrganization(app);
    await connectProvider(app, organizationId, false);
    const verified = await addDomain(app, organizationId, "verified");
    const failed = await addDomain(app, organizationId, "failed");
    const [email] = await addEmails(app, organizationId, verified.id, ["sent"]);
    const [event] = await app.db
      .insert(schema.emailEvents)
      .values({ emailId: email!.id, type: "delivered", providerEventId: uuidv7(), occurredAt: new Date(), payload: { recipients: [] } })
      .returning();
    const [endpoint] = await app.db
      .insert(schema.webhookEndpoints)
      .values({ organizationId, url: "https://hooks.example.com/mail", eventTypes: ["delivered"], signingSecretEncrypted: "ciphertext", encryptionKeyVersion: 1 })
      .returning();
    await app.db.insert(schema.webhookDeliveries).values({
      webhookEndpointId: endpoint!.id,
      emailEventId: event!.id,
      payload: { type: "email.delivered", createdAt: new Date().toISOString(), data: { emailId: email!.id, from: "hello@example.com", to: ["ada@example.org"], subject: "Hi", recipients: [] } },
      status: "failed",
      attemptCount: 8,
    });

    const body = (await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: owner.headers })).json();
    const kinds = body.attention.map((item: { kind: string }) => item.kind);

    assert.equal(body.health, "critical");
    assert.equal(body.attention[0].kind, "domain_failed");
    assert.equal(body.attention[0].targetId, failed.id);
    assert.ok(kinds.includes("events_not_connected"));
    assert.ok(kinds.includes("webhook_failing"));
    assert.equal(body.setup.webhooks, 1);
    assert.deepEqual(body.setup.domains, { total: 2, verified: 1, pending: 0, failed: 1 });
  });

  it("shows members the overview but hides it from outsiders", async () => {
    const app = await buildPanelTestApp();
    const { owner, organizationId } = await setUpOrganization(app);
    const member = await signUp(app);
    const outsider = await signUp(app);
    await addPanelMember(app, owner, organizationId, member, "member");

    const asMember = await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: member.headers });
    const asOutsider = await app.inject({ method: "GET", url: overviewUrl(organizationId), headers: outsider.headers });

    assert.equal(asMember.statusCode, 200);
    assert.equal(asOutsider.statusCode, 404);
  });
});
