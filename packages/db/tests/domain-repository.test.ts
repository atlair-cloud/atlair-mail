import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { hasPgErrorCode, pgErrorCodes } from "../src/errors.ts";
import {
  deleteDomain,
  findDomainInOrganization,
  insertDomain,
  listDomainsByOrganization,
  updateDomainVerification,
} from "../src/repositories/domains.ts";
import { emails } from "../src/schema/index.ts";
import { databaseUrl, newEmail, useTestDb } from "./helpers.ts";

const domainName = () => `${uuidv7()}.example.com`;

describe("domain repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("insert returns null for a name the organization already has", async () => {
    const organization = await t.newOrganization();
    const name = domainName();

    const first = await insertDomain(t.db, { organizationId: organization.id, name });
    const duplicate = await insertDomain(t.db, { organizationId: organization.id, name });

    assert.ok(first);
    assert.equal(duplicate, null);
  });

  test("lists and finds only within the organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const older = await insertDomain(t.db, { organizationId: organization.id, name: domainName() });
    const newer = await insertDomain(t.db, { organizationId: organization.id, name: domainName() });
    const elsewhere = await insertDomain(t.db, { organizationId: other.id, name: domainName() });

    const listed = await listDomainsByOrganization(t.db, organization.id);

    assert.deepEqual(
      listed.map((domain) => domain.id),
      [newer!.id, older!.id],
    );
    assert.equal(await findDomainInOrganization(t.db, { id: elsewhere!.id, organizationId: organization.id }), null);
    assert.equal(
      await updateDomainVerification(t.db, { id: elsewhere!.id, organizationId: organization.id }, { status: "verified" }),
      null,
    );
    assert.equal(await deleteDomain(t.db, { id: elsewhere!.id, organizationId: organization.id }), null);
  });

  test("records checks and keeps the first verified time only while verified", async () => {
    const organization = await t.newOrganization();
    const domain = (await insertDomain(t.db, { organizationId: organization.id, name: domainName() }))!;
    const key = { id: domain.id, organizationId: organization.id };

    const pending = await updateDomainVerification(t.db, key, {
      status: "pending",
      dkimTokens: ["a", "b", "c"],
      dkimSigningHostedZone: "dkim.amazonses.com",
    });
    const verified = await updateDomainVerification(t.db, key, { status: "verified" });
    const again = await updateDomainVerification(t.db, key, { status: "verified" });
    const failed = await updateDomainVerification(t.db, key, { status: "failed" });

    assert.ok(pending?.lastCheckedAt);
    assert.deepEqual(pending.dkimTokens, ["a", "b", "c"]);
    assert.equal(pending.verifiedAt, null);
    assert.ok(verified?.verifiedAt);
    assert.equal(again?.verifiedAt?.getTime(), verified.verifiedAt.getTime());
    assert.deepEqual(again.dkimTokens, ["a", "b", "c"]);
    assert.equal(failed?.verifiedAt, null);
  });

  test("delete is blocked while emails reference the domain", async () => {
    const organization = await t.newOrganization();
    const domain = (await insertDomain(t.db, { organizationId: organization.id, name: domainName() }))!;
    await t.db.insert(emails).values(newEmail(organization.id, domain.id));

    await assert.rejects(
      deleteDomain(t.db, { id: domain.id, organizationId: organization.id }),
      (error) => hasPgErrorCode(error, pgErrorCodes.foreignKeyViolation),
    );
  });
});
