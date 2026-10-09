import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  AlreadyExistsException,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  SendEmailCommand,
  SESv2Client,
  UpdateConfigurationSetEventDestinationCommand,
} from "@aws-sdk/client-sesv2";
import {
  AuthorizationErrorException,
  ConfirmSubscriptionCommand,
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SNSClient,
  SubscribeCommand,
  ThrottledException,
} from "@aws-sdk/client-sns";
import { createProvider, ProviderRejectedError, ProviderThrottledError, type SesSettings } from "../src/index.ts";

const topicArn = "arn:aws:sns:ap-south-1:123456789012:atlair-mail-events";
const connectionId = "0199c7c2-1111-7000-8000-000000000001";
const endpoint = `https://mail.example.com/webhooks/provider-events/${connectionId}`;
const push = { mode: "push" as const, endpointUrl: endpoint };
const baseSettings: SesSettings = { region: "ap-south-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" };

const providerWith = (settings: SesSettings = baseSettings) =>
  createProvider({ type: "ses", settings, secrets: { secretAccessKey: "secret" } }, { retry: false });

const ses = mockClient(SESv2Client);
const sns = mockClient(SNSClient);

const exists = () => new AlreadyExistsException({ message: "exists", $metadata: {} });

beforeEach(() => {
  ses.reset();
  sns.reset();
  sns.on(CreateTopicCommand).resolves({ TopicArn: topicArn });
  sns.on(SetTopicAttributesCommand).resolves({});
  sns.on(SubscribeCommand).resolves({ SubscriptionArn: "pending confirmation" });
  ses.on(CreateConfigurationSetCommand).resolves({});
  ses.on(CreateConfigurationSetEventDestinationCommand).resolves({});
});

describe("SES event publishing setup", () => {
  it("creates the topic, lets only this account's configuration set publish, and subscribes the endpoint", async () => {
    const configured = await providerWith().configureEvents(connectionId, push);

    assert.deepEqual(configured, {
      settings: { ...baseSettings, eventTopicArn: topicArn, configurationSetName: "atlair-mail" },
      subscriptionActive: false,
    });
    assert.deepEqual(sns.commandCalls(CreateTopicCommand)[0]!.args[0].input, { Name: "atlair-mail-events" });
    const policyInput = sns.commandCalls(SetTopicAttributesCommand)[0]!.args[0].input;
    assert.equal(policyInput.AttributeName, "Policy");
    assert.deepEqual(JSON.parse(policyInput.AttributeValue!).Statement, [
      {
        Sid: "AllowSesEventPublishing",
        Effect: "Allow",
        Principal: { Service: "ses.amazonaws.com" },
        Action: "sns:Publish",
        Resource: topicArn,
        Condition: {
          StringEquals: {
            "AWS:SourceAccount": "123456789012",
            "AWS:SourceArn": "arn:aws:ses:ap-south-1:123456789012:configuration-set/atlair-mail",
          },
        },
      },
    ]);
    assert.deepEqual(ses.commandCalls(CreateConfigurationSetEventDestinationCommand)[0]!.args[0].input, {
      ConfigurationSetName: "atlair-mail",
      EventDestinationName: "atlair-mail-events",
      EventDestination: {
        Enabled: true,
        MatchingEventTypes: ["SEND", "REJECT", "BOUNCE", "COMPLAINT", "DELIVERY", "DELIVERY_DELAY"],
        SnsDestination: { TopicArn: topicArn },
      },
    });
    assert.deepEqual(sns.commandCalls(SubscribeCommand)[0]!.args[0].input, {
      TopicArn: topicArn,
      Protocol: "https",
      Endpoint: endpoint,
    });
  });

  it("can run again on an account that is already set up", async () => {
    ses.on(CreateConfigurationSetCommand).rejects(exists());
    ses.on(CreateConfigurationSetEventDestinationCommand).rejects(exists());
    ses.on(UpdateConfigurationSetEventDestinationCommand).resolves({});

    const { settings } = await providerWith().configureEvents(connectionId, push);

    assert.equal(settings.eventTopicArn, topicArn);
    assert.equal(ses.commandCalls(UpdateConfigurationSetEventDestinationCommand).length, 1);
    assert.equal(sns.commandCalls(SubscribeCommand).length, 1);
  });

  it("maps missing permissions and throttling to provider errors", async () => {
    sns.on(CreateTopicCommand).rejects(new AuthorizationErrorException({ message: "denied", $metadata: {} }));
    await assert.rejects(providerWith().configureEvents(connectionId, push), (error) => {
      assert.ok(error instanceof ProviderRejectedError);
      assert.equal(error.summary, "ATL_PROVIDER_REJECTED: AuthorizationErrorException");
      return true;
    });

    sns.on(CreateTopicCommand).rejects(new ThrottledException({ message: "slow down", $metadata: {} }));
    await assert.rejects(providerWith().configureEvents(connectionId, push), ProviderThrottledError);
  });

  it("confirms a subscription so that only the topic owner can unsubscribe", async () => {
    sns.on(ConfirmSubscriptionCommand).resolves({ SubscriptionArn: `${topicArn}:sub` });

    await providerWith({ ...baseSettings, eventTopicArn: topicArn }).confirmEvents("token-1");

    assert.deepEqual(sns.commandCalls(ConfirmSubscriptionCommand)[0]!.args[0].input, {
      TopicArn: topicArn,
      Token: "token-1",
      AuthenticateOnUnsubscribe: "true",
    });
  });

  it("refuses to confirm before events are set up", async () => {
    await assert.rejects(providerWith().confirmEvents("token-1"), (error) => {
      assert.ok(error instanceof ProviderRejectedError);
      assert.equal(error.reason, "EventsNotConfigured");
      return true;
    });
    assert.equal(sns.commandCalls(ConfirmSubscriptionCommand).length, 0);
  });

  it("sends through the configuration set once events are set up", async () => {
    ses.on(SendEmailCommand).resolves({ MessageId: "m-1" });
    const message = {
      from: { address: "hello@mail.example.com" },
      to: [{ address: "ada@example.org" }],
      subject: "Hi",
      text: "Hi",
    };

    await providerWith({ ...baseSettings, configurationSetName: "atlair-mail" }).send(message);
    await providerWith().send(message);

    const [withSet, without] = ses.commandCalls(SendEmailCommand).map((call) => call.args[0].input);
    assert.equal(withSet!.ConfigurationSetName, "atlair-mail");
    assert.equal(without!.ConfigurationSetName, undefined);
  });
});
