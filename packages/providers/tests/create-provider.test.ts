import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import { GetEmailIdentityCommand, SendEmailCommand, SESv2Client, SESv2ServiceException } from "@aws-sdk/client-sesv2";
import { createProvider, type ProviderConfig, type ProviderLogger } from "../src/index.ts";

const config: ProviderConfig = {
  type: "ses",
  settings: { region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" },
  secrets: { secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
};
const ses = mockClient(SESv2Client);
const serverError = () =>
  new SESv2ServiceException({ name: "InternalFailure", $fault: "server", $metadata: {}, message: "x" });

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const logger: ProviderLogger = {
    info: (fields) => lines.push(fields as Record<string, unknown>),
    warn: (fields) => lines.push(fields as Record<string, unknown>),
  };
  return { logger, lines };
}

beforeEach(() => ses.reset());

describe("createProvider", () => {
  it("retries around logging, so every attempt is logged", async () => {
    const { logger, lines } = captureLogger();
    ses
      .on(GetEmailIdentityCommand)
      .rejectsOnce(serverError())
      .resolves({ VerificationStatus: "SUCCESS", VerifiedForSendingStatus: true });

    const domain = await createProvider(config, { logger, retry: { minTimeout: 1, maxTimeout: 2 } }).getDomain(
      "example.com",
    );

    assert.equal(domain?.status, "verified");
    assert.deepEqual(
      lines.map((line) => [line.operation, line.outcome, line.errorCode]),
      [
        ["getDomain", "error", "ATL_PROVIDER_UNAVAILABLE"],
        ["getDomain", "ok", undefined],
      ],
    );
  });

  it("can turn retries off", async () => {
    ses.on(SendEmailCommand).rejects(serverError());

    await assert.rejects(
      createProvider(config, { retry: false }).send({ from: "a@example.com", to: ["b@example.org"], subject: "s", text: "t" }),
    );
    assert.equal(ses.commandCalls(SendEmailCommand).length, 1);
  });

  it("never logs the credentials", async () => {
    const { logger, lines } = captureLogger();
    ses.on(GetEmailIdentityCommand).rejects(serverError());

    await assert.rejects(createProvider(config, { logger, retry: { minTimeout: 1, maxTimeout: 2 } }).getDomain("example.com"));

    assert.equal(lines.length, 3);
    assert.ok(!JSON.stringify(lines).includes(config.secrets.secretAccessKey));
    assert.ok(!JSON.stringify(lines).includes(config.settings.accessKeyId));
  });
});
