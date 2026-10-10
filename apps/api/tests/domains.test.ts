import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
  SESv2ServiceException,
} from "@aws-sdk/client-sesv2";
import { schema } from "@atlair-mail/db";
import { v7 as uuidv7 } from "uuid";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/service/web/domains";
const ses = mockClient(SESv2Client);
const tokens = ["tokenone", "tokentwo", "tokenthree"];
const zone = "dkim.eu-west-1.example-zone.com";

const identity = (status: "PENDING" | "SUCCESS" | "FAILED" | "TEMPORARY_FAILURE") => ({
  DkimAttributes: { Tokens: tokens, SigningHostedZone: zone, Status: status },
  VerificationStatus: status,
  VerifiedForSendingStatus: status === "SUCCESS",
});

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

async function connectedOrganization(app: TestApp) {
  const owner = await createTestKey(app);
  await app.inject({
    method: "PUT",
    url: "/service/web/provider",
    headers: auth(owner.token),
    payload: { type: "ses", region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "secret" },
  });
  return owner;
}

const addDomain = (app: TestApp, token: string, name = `${uuidv7()}.example.com`) =>
  app.inject({ method: "POST", url, headers: auth(token), payload: { name } });

beforeEach(() => {
  ses.reset();
  ses.on(GetAccountCommand).resolves({ SendingEnabled: true });
  ses.on(CreateEmailIdentityCommand).resolves({
    DkimAttributes: { Tokens: tokens, SigningHostedZone: zone, Status: "PENDING" },
    VerifiedForSendingStatus: false,
  });
});

describe("/service/web/domains", { skip: !hasDatabase }, () => {
  it("adds a domain and returns publishable DNS records", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);

    const res = await addDomain(app, token, " Mail.Example-Shop.co.uk. ");
    const body = res.json();

    assert.equal(res.statusCode, 201);
    assert.equal(body.name, "mail.example-shop.co.uk");
    assert.equal(body.status, "pending");
    assert.deepEqual(body.records, [
      ...tokens.map((token) => ({
        record: "DKIM",
        type: "CNAME",
        name: `${token}._domainkey.mail.example-shop.co.uk`,
        value: `${token}.${zone}`,
        required: true,
        status: "pending",
      })),
      {
        record: "DMARC",
        type: "TXT",
        name: "_dmarc.mail.example-shop.co.uk",
        value: "v=DMARC1; p=none;",
        required: false,
        status: null,
      },
    ]);
    assert.deepEqual(Object.keys(body).sort(), [
      "createdAt",
      "createdBy",
      "id",
      "lastCheckedAt",
      "name",
      "records",
      "status",
      "updatedAt",
      "updatedBy",
      "verifiedAt",
    ]);
    assert.equal(body.createdBy.type, "api_key");
    assert.equal(ses.commandCalls(CreateEmailIdentityCommand)[0]!.args[0].input.EmailIdentity, body.name);
  });

  it("adopts a domain that already exists in the provider account", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);
    ses.on(CreateEmailIdentityCommand).rejects(new AlreadyExistsException({ message: "x", $metadata: {} }));
    ses.on(GetEmailIdentityCommand).resolves(identity("SUCCESS"));

    const body = (await addDomain(app, token)).json();

    assert.equal(body.status, "verified");
    assert.ok(body.verifiedAt);
  });

  it("moves through pending, verified and failed on verify", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);
    const { id } = (await addDomain(app, token)).json();
    const verify = async () =>
      (await app.inject({ method: "POST", url: `${url}/${id}/verify`, headers: auth(token) })).json();

    ses.on(GetEmailIdentityCommand).resolves(identity("TEMPORARY_FAILURE"));
    const temporary = await verify();
    ses.on(GetEmailIdentityCommand).resolves(identity("SUCCESS"));
    const verified = await verify();
    ses.on(GetEmailIdentityCommand).resolves(identity("FAILED"));
    const failed = await verify();
    ses.on(GetEmailIdentityCommand).rejects(new NotFoundException({ message: "x", $metadata: {} }));
    const missing = await verify();
    const stored = (await app.inject({ method: "GET", url: `${url}/${id}`, headers: auth(token) })).json();

    assert.equal(temporary.status, "pending");
    assert.equal(verified.status, "verified");
    assert.ok(verified.verifiedAt);
    assert.equal(failed.status, "failed");
    assert.equal(failed.verifiedAt, null);
    assert.equal(missing.status, "failed");
    assert.equal(missing.records.length, 4);
    assert.equal(stored.status, "failed");
    assert.ok(stored.lastCheckedAt);
  });

  it("lists, gets and removes domains", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);
    const first = (await addDomain(app, token)).json();
    const second = (await addDomain(app, token)).json();

    const { data } = (await app.inject({ method: "GET", url, headers: auth(token) })).json();
    const removed = await app.inject({ method: "DELETE", url: `${url}/${first.id}`, headers: auth(token) });
    const gone = await app.inject({ method: "GET", url: `${url}/${first.id}`, headers: auth(token) });

    assert.deepEqual(
      data.map((domain: { id: string }) => domain.id),
      [second.id, first.id],
    );
    assert.equal(removed.statusCode, 204);
    assert.equal(gone.statusCode, 404);
  });
});

describe("/service/web/domains return path", { skip: !hasDatabase }, () => {
  const mailFrom = (status: "PENDING" | "SUCCESS") => ({
    ...identity("SUCCESS"),
    MailFromAttributes: {
      MailFromDomain: "bounce.placeholder",
      MailFromDomainStatus: status,
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE" as const,
    },
  });

  it("configures bounce.<domain> once the domain is verified and returns its records", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);
    const { id, name } = (await addDomain(app, token)).json();
    const verify = async () =>
      (await app.inject({ method: "POST", url: `${url}/${id}/verify`, headers: auth(token) })).json();

    ses.on(GetEmailIdentityCommand).resolves(identity("PENDING"));
    const pending = await verify();
    const putsWhilePending = ses.commandCalls(PutEmailIdentityMailFromAttributesCommand).length;

    ses.reset();
    ses
      .on(GetEmailIdentityCommand)
      .resolvesOnce(identity("SUCCESS"))
      .resolves({
        ...mailFrom("PENDING"),
        MailFromAttributes: { ...mailFrom("PENDING").MailFromAttributes, MailFromDomain: `bounce.${name}` },
      });
    const verified = await verify();
    const again = await verify();

    assert.equal(pending.status, "pending");
    assert.equal(putsWhilePending, 0);
    assert.equal(verified.status, "verified");
    assert.deepEqual(ses.commandCalls(PutEmailIdentityMailFromAttributesCommand)[0]!.args[0].input, {
      EmailIdentity: name,
      MailFromDomain: `bounce.${name}`,
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    });
    assert.equal(ses.commandCalls(PutEmailIdentityMailFromAttributesCommand).length, 1);
    assert.deepEqual(
      verified.records
        .filter((record: { record: string }) => ["MAIL_FROM", "SPF"].includes(record.record))
        .map((record: { record: string; name: string; status: string }) => [record.record, record.name, record.status]),
      [
        ["MAIL_FROM", `bounce.${name}`, "pending"],
        ["SPF", `bounce.${name}`, "pending"],
      ],
    );
    assert.equal(again.records.length, verified.records.length);
  });

  it("still verifies when the provider refuses the return path", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);
    const { id } = (await addDomain(app, token)).json();
    ses.on(GetEmailIdentityCommand).resolves(identity("SUCCESS"));
    ses
      .on(PutEmailIdentityMailFromAttributesCommand)
      .rejects(new SESv2ServiceException({ name: "AccessDeniedException", $fault: "client", $metadata: {}, message: "x" }));

    const res = await app.inject({ method: "POST", url: `${url}/${id}/verify`, headers: auth(token) });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, "verified");
    assert.ok(!res.json().records.some((record: { record: string }) => record.record === "MAIL_FROM"));
  });
});

describe("/service/web/domains rejections and isolation", { skip: !hasDatabase }, () => {
  it("requires a connected provider first", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const res = await addDomain(app, token);

    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, "ATL_PROVIDER_NOT_CONNECTED");
    assert.match(res.json().message, /\/service\/web\/provider/);
    assert.equal(ses.commandCalls(CreateEmailIdentityCommand).length, 0);
  });

  it("rejects invalid and duplicate names", async () => {
    const app = await buildTestApp();
    const { token } = await connectedOrganization(app);
    const name = `${uuidv7()}.example.com`;

    for (const invalid of ["co.uk", "127.0.0.1", "localhost", "example.com/x", ""]) {
      assert.equal((await addDomain(app, token, invalid)).statusCode, 400, invalid);
    }
    assert.equal((await addDomain(app, token, name)).statusCode, 201);
    assert.equal((await addDomain(app, token, name.toUpperCase())).statusCode, 409);
  });

  it("refuses to remove a domain that has emails", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await connectedOrganization(app);
    const { id } = (await addDomain(app, token)).json();
    await app.db.insert(schema.emails).values({
      organizationId,
      domainId: id,
      fromAddress: "hello@example.com",
      toAddresses: ["user@example.org"],
      subject: "Hi",
      textBody: "Hi",
    });

    const res = await app.inject({ method: "DELETE", url: `${url}/${id}`, headers: auth(token) });

    assert.equal(res.statusCode, 409);
  });

  it("requires a full_access key", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app, { permission: "sending_access" });

    assert.equal((await addDomain(app, token)).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url, headers: auth(token) })).statusCode, 403);
  });

  it("never exposes or changes another organization's domains", async () => {
    const app = await buildTestApp();
    const first = await connectedOrganization(app);
    const second = await connectedOrganization(app);
    const { id } = (await addDomain(app, first.token)).json();
    const as = (method: "GET" | "POST" | "DELETE", path: string) =>
      app.inject({ method, url: `${url}${path}`, headers: auth(second.token) });

    const { data } = (await as("GET", "")).json();

    assert.deepEqual(data, []);
    assert.equal((await as("GET", `/${id}`)).statusCode, 404);
    assert.equal((await as("POST", `/${id}/verify`)).statusCode, 404);
    assert.equal((await as("DELETE", `/${id}`)).statusCode, 404);
    assert.equal(ses.commandCalls(GetEmailIdentityCommand).length, 0);
    assert.equal(
      (await app.inject({ method: "GET", url: `${url}/${id}`, headers: auth(first.token) })).statusCode,
      200,
    );
  });
});
