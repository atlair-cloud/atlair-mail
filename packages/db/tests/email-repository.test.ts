import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { findDomainByName } from "../src/repositories/domains.ts";
import { findEmailByIdempotencyKey, findEmailInOrganization, insertEmail } from "../src/repositories/emails.ts";
import { findSuppressedAddresses } from "../src/repositories/suppressed-addresses.ts";
import { suppressedAddresses } from "../src/schema/index.ts";
import { CHECK_VIOLATION, databaseUrl, newEmail, pgError, useTestDb } from "./helpers.ts";

describe("email repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("insert ignores a repeated idempotency key and returns null", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const keyed = { idempotencyKey: "order-42", requestFingerprint: "abc" };

    const first = await insertEmail(t.db, newEmail(organization.id, domain.id, keyed));
    const repeat = await insertEmail(t.db, newEmail(organization.id, domain.id, keyed));
    const unkeyedA = await insertEmail(t.db, newEmail(organization.id, domain.id));
    const unkeyedB = await insertEmail(t.db, newEmail(organization.id, domain.id));

    assert.ok(first);
    assert.equal(repeat, null);
    assert.ok(unkeyedA && unkeyedB && unkeyedA.id !== unkeyedB.id);
    assert.equal((await findEmailByIdempotencyKey(t.db, organization.id, "order-42"))?.id, first.id);
  });

  test("idempotency keys are scoped to the organization", async () => {
    const first = await t.newOrganization();
    const second = await t.newOrganization();
    const keyed = { idempotencyKey: "same-key", requestFingerprint: "abc" };

    const a = await insertEmail(t.db, newEmail(first.id, (await t.newDomain(first.id)).id, keyed));
    const b = await insertEmail(t.db, newEmail(second.id, (await t.newDomain(second.id)).id, keyed));

    assert.ok(a && b && a.id !== b.id);
    assert.equal((await findEmailByIdempotencyKey(t.db, second.id, "same-key"))?.id, b.id);
  });

  test("a key always comes with a fingerprint", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);

    await assert.rejects(
      insertEmail(t.db, newEmail(organization.id, domain.id, { idempotencyKey: "k" })),
      pgError(CHECK_VIOLATION),
    );
  });

  test("finds emails and domains only within the organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const email = (await insertEmail(t.db, newEmail(organization.id, domain.id)))!;

    assert.equal((await findEmailInOrganization(t.db, { id: email.id, organizationId: organization.id }))?.id, email.id);
    assert.equal(await findEmailInOrganization(t.db, { id: email.id, organizationId: other.id }), null);
    assert.equal((await findDomainByName(t.db, organization.id, domain.name))?.id, domain.id);
    assert.equal(await findDomainByName(t.db, other.id, domain.name), null);
  });

  test("finds suppressed recipients case-insensitively within the organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    await t.db.insert(suppressedAddresses).values([
      { organizationId: organization.id, address: "bounced@example.org", reason: "hard_bounce" },
      { organizationId: other.id, address: "elsewhere@example.org", reason: "complaint" },
    ]);

    const found = await findSuppressedAddresses(t.db, organization.id, [
      "Bounced@Example.org",
      "fine@example.org",
      "elsewhere@example.org",
    ]);

    assert.deepEqual(found, ["bounced@example.org"]);
    assert.deepEqual(await findSuppressedAddresses(t.db, organization.id, []), []);
  });
});
