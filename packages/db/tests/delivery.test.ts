import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import {
  emailEvents,
  emails,
  providerConnections,
  suppressedAddresses,
  webhookDeliveries,
  webhookEndpoints,
  type NewProviderConnection,
} from "../src/schema/index.ts";
import type { WebhookPayload } from "../src/types.ts";
import {
  CHECK_VIOLATION,
  databaseUrl,
  newEmail,
  pgError,
  UNIQUE_VIOLATION,
  useTestDb,
} from "./helpers.ts";

const connection = (organizationId: string): NewProviderConnection => ({
  organizationId,
  provider: "ses",
  settings: { region: "us-east-1", accessKeyId: "AKIAEXAMPLE" },
  credentialsEncrypted: "ciphertext",
  encryptionKeyVersion: 1,
});

describe("provider_connections, suppressed_addresses, and webhooks", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("an organization has at most one provider connection", async () => {
    const organization = await t.newOrganization();
    await t.db.insert(providerConnections).values(connection(organization.id));

    await assert.rejects(
      t.db.insert(providerConnections).values(connection(organization.id)),
      pgError(UNIQUE_VIOLATION),
    );
  });

  test("a suppressed address is lowercase and unique per organization", async () => {
    const organization = await t.newOrganization();
    const address = `${uuidv7()}@example.org`;
    await t.db
      .insert(suppressedAddresses)
      .values({ organizationId: organization.id, address, reason: "hard_bounce" });

    await assert.rejects(
      t.db
        .insert(suppressedAddresses)
        .values({ organizationId: organization.id, address, reason: "complaint" }),
      pgError(UNIQUE_VIOLATION),
    );
    await assert.rejects(
      t.db.insert(suppressedAddresses).values({
        organizationId: organization.id,
        address: address.toUpperCase(),
        reason: "manual",
      }),
      pgError(CHECK_VIOLATION),
    );
  });

  test("a webhook endpoint subscribes to at least one event type", async () => {
    const organization = await t.newOrganization();

    await assert.rejects(
      t.db.insert(webhookEndpoints).values({
        organizationId: organization.id,
        url: "https://example.org/hooks",
        eventTypes: [],
        signingSecretEncrypted: "ciphertext",
        encryptionKeyVersion: 1,
      }),
      pgError(CHECK_VIOLATION),
    );
  });

  test("an event is queued for an endpoint at most once", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const [email] = await t.db.insert(emails).values(newEmail(organization.id, domain.id)).returning();
    assert.ok(email);
    const [event] = await t.db
      .insert(emailEvents)
      .values({
        emailId: email.id,
        type: "delivered",
        providerEventId: uuidv7(),
        occurredAt: new Date(),
        payload: { recipients: [{ address: "user@example.org" }] },
      })
      .returning();
    const [endpoint] = await t.db
      .insert(webhookEndpoints)
      .values({
        organizationId: organization.id,
        url: "https://example.org/hooks",
        eventTypes: ["delivered"],
        signingSecretEncrypted: "ciphertext",
        encryptionKeyVersion: 1,
      })
      .returning();
    assert.ok(event && endpoint);

    const payload: WebhookPayload = {
      type: "email.delivered",
      createdAt: new Date().toISOString(),
      data: {
        emailId: email.id,
        from: email.fromAddress,
        to: email.toAddresses,
        subject: email.subject,
        recipients: [{ address: "user@example.org" }],
      },
    };
    const delivery = { webhookEndpointId: endpoint.id, emailEventId: event.id, payload };

    const [queued] = await t.db.insert(webhookDeliveries).values(delivery).returning();
    assert.equal(queued?.status, "pending");
    await assert.rejects(
      t.db.insert(webhookDeliveries).values(delivery),
      pgError(UNIQUE_VIOLATION),
    );
  });
});
