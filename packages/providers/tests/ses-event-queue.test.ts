import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import {
  CreateTopicCommand,
  ListSubscriptionsByTopicCommand,
  SetTopicAttributesCommand,
  SNSClient,
  SubscribeCommand,
  UnsubscribeCommand,
} from "@aws-sdk/client-sns";
import {
  CreateQueueCommand,
  DeleteMessageBatchCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  QueueDeletedRecently,
  QueueDoesNotExist,
  ReceiveMessageCommand,
  SetQueueAttributesCommand,
  SQSClient,
  StartMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";
import { createProvider, ProviderRejectedError, ProviderUnavailableError, type SesSettings } from "../src/index.ts";

const account = "123456789012";
const topicArn = `arn:aws:sns:ap-south-1:${account}:atlair-mail-events`;
const connectionId = "0199c7c2-1111-7000-8000-000000000001";
const otherConnectionId = "0199c7c2-2222-7000-8000-000000000002";
const queueName = `atlair-mail-events-${connectionId}`;
const deadLetterName = `${queueName}-dlq`;
const queueArn = `arn:aws:sqs:ap-south-1:${account}:${queueName}`;
const deadLetterArn = `${queueArn}-dlq`;
const queueUrl = `https://sqs.ap-south-1.amazonaws.com/${account}/${queueName}`;
const deadLetterUrl = `${queueUrl}-dlq`;
const baseSettings: SesSettings = { region: "ap-south-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" };
const pullSettings: SesSettings = {
  ...baseSettings,
  eventTopicArn: topicArn,
  configurationSetName: "atlair-mail",
  eventQueueUrl: queueUrl,
  eventDeadLetterQueueUrl: deadLetterUrl,
};

const providerWith = (settings: SesSettings = baseSettings) =>
  createProvider({ type: "ses", settings, secrets: { secretAccessKey: "secret" } }, { retry: false });

const ses = mockClient(SESv2Client);
const sns = mockClient(SNSClient);
const sqs = mockClient(SQSClient);

const missingQueue = () => new QueueDoesNotExist({ message: "missing", $metadata: {} });

beforeEach(() => {
  ses.reset();
  sns.reset();
  sqs.reset();
  sns.on(CreateTopicCommand).resolves({ TopicArn: topicArn });
  sns.on(SetTopicAttributesCommand).resolves({});
  sns.on(SubscribeCommand).resolves({ SubscriptionArn: `${topicArn}:sqs-sub` });
  ses.on(CreateConfigurationSetCommand).resolves({});
  ses.on(CreateConfigurationSetEventDestinationCommand).resolves({});
  sqs.on(GetQueueUrlCommand).rejects(missingQueue());
  sqs.on(CreateQueueCommand, { QueueName: deadLetterName }).resolves({ QueueUrl: deadLetterUrl });
  sqs.on(CreateQueueCommand, { QueueName: queueName }).resolves({ QueueUrl: queueUrl });
});

describe("pull mode setup", () => {
  it("creates an encrypted queue and dead-letter queue that only the event topic can send to", async () => {
    const configured = await providerWith().configureEvents(connectionId, { mode: "pull" });

    assert.deepEqual(configured, {
      settings: pullSettings,
      subscriptionActive: true,
    });
    const [deadLetter, queue] = sqs.commandCalls(CreateQueueCommand).map((call) => call.args[0].input);
    assert.equal(deadLetter!.QueueName, deadLetterName);
    assert.equal(queue!.QueueName, queueName);

    const attributes = queue!.Attributes!;
    assert.equal(attributes.SqsManagedSseEnabled, "true");
    assert.equal(attributes.MessageRetentionPeriod, "1209600");
    assert.equal(attributes.VisibilityTimeout, "120");
    assert.equal(attributes.ReceiveMessageWaitTimeSeconds, "10");
    assert.deepEqual(JSON.parse(attributes.RedrivePolicy!), { deadLetterTargetArn: deadLetterArn, maxReceiveCount: 10 });
    assert.deepEqual(JSON.parse(attributes.Policy!).Statement, [
      {
        Sid: "AllowEventTopic",
        Effect: "Allow",
        Principal: { Service: "sns.amazonaws.com" },
        Action: "sqs:SendMessage",
        Resource: queueArn,
        Condition: { ArnEquals: { "aws:SourceArn": topicArn }, StringEquals: { "aws:SourceAccount": account } },
      },
      {
        Sid: "DenyInsecureTransport",
        Effect: "Deny",
        Principal: "*",
        Action: "sqs:*",
        Resource: queueArn,
        Condition: { Bool: { "aws:SecureTransport": "false" } },
      },
    ]);

    const deadLetterAttributes = deadLetter!.Attributes!;
    assert.equal(deadLetterAttributes.SqsManagedSseEnabled, "true");
    assert.deepEqual(JSON.parse(deadLetterAttributes.RedriveAllowPolicy!), {
      redrivePermission: "byQueue",
      sourceQueueArns: [queueArn],
    });
    assert.deepEqual(
      JSON.parse(deadLetterAttributes.Policy!).Statement.map((statement: { Effect: string }) => statement.Effect),
      ["Deny"],
    );

    assert.deepEqual(sns.commandCalls(SubscribeCommand)[0]!.args[0].input, {
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: queueArn,
      Attributes: { RawMessageDelivery: "false" },
      ReturnSubscriptionArn: true,
    });
  });

  it("reapplies the same attributes to queues that already exist instead of failing", async () => {
    sqs.on(GetQueueUrlCommand, { QueueName: deadLetterName }).resolves({ QueueUrl: deadLetterUrl });
    sqs.on(GetQueueUrlCommand, { QueueName: queueName }).resolves({ QueueUrl: queueUrl });
    sqs.on(SetQueueAttributesCommand).resolves({});

    const { settings } = await providerWith().configureEvents(connectionId, { mode: "pull" });

    assert.equal(settings.eventQueueUrl, queueUrl);
    assert.equal(sqs.commandCalls(CreateQueueCommand).length, 0);
    const updated = sqs.commandCalls(SetQueueAttributesCommand).map((call) => call.args[0].input);
    assert.deepEqual(
      updated.map((input) => input.QueueUrl),
      [deadLetterUrl, queueUrl],
    );
    assert.ok(JSON.parse(updated[1]!.Attributes!.Policy!).Statement[0].Condition.ArnEquals);
  });

  it("names queues per connection so organizations sharing an AWS account never share a queue", async () => {
    await providerWith().configureEvents(otherConnectionId, { mode: "pull" }).catch(() => {});

    const names = sqs.commandCalls(GetQueueUrlCommand).map((call) => call.args[0].input.QueueName);
    assert.ok(names.every((name) => name!.includes(otherConnectionId)));
    assert.ok(names.every((name) => name!.length <= 80 && /^[A-Za-z0-9_-]+$/.test(name!)));
  });

  it("reports a queue deleted moments ago as a temporary problem", async () => {
    sqs.on(CreateQueueCommand).rejects(new QueueDeletedRecently({ message: "wait 60s", $metadata: {} }));

    await assert.rejects(providerWith().configureEvents(connectionId, { mode: "pull" }), (error) => {
      assert.ok(error instanceof ProviderUnavailableError);
      assert.equal(error.retryable, true);
      assert.equal(error.reason, "QueueDeletedRecently");
      return true;
    });
    assert.equal(sns.commandCalls(SubscribeCommand).length, 0);
  });

  it("reports a subscription that still needs confirmation as not active", async () => {
    sns.on(SubscribeCommand).resolves({ SubscriptionArn: "pending confirmation" });

    const { subscriptionActive } = await providerWith().configureEvents(connectionId, { mode: "pull" });

    assert.equal(subscriptionActive, false);
  });
});

describe("removing subscriptions", () => {
  const subscriptions = [
    { SubscriptionArn: `${topicArn}:a`, Protocol: "https", Endpoint: `https://old.example.com/webhooks/provider-events/${connectionId}` },
    { SubscriptionArn: `${topicArn}:b`, Protocol: "https", Endpoint: `https://new.example.com/webhooks/provider-events/${connectionId}` },
    { SubscriptionArn: "PendingConfirmation", Protocol: "https", Endpoint: `https://x.example.com/webhooks/provider-events/${connectionId}` },
    { SubscriptionArn: `${topicArn}:c`, Protocol: "https", Endpoint: `https://mail.example.com/webhooks/provider-events/${otherConnectionId}` },
    { SubscriptionArn: `${topicArn}:d`, Protocol: "sqs", Endpoint: queueArn },
    { SubscriptionArn: `${topicArn}:e`, Protocol: "sqs", Endpoint: queueArn.replace(connectionId, otherConnectionId) },
  ];

  beforeEach(() => {
    sns.on(ListSubscriptionsByTopicCommand, { TopicArn: topicArn, NextToken: undefined }).resolves({
      Subscriptions: subscriptions.slice(0, 3),
      NextToken: "page-2",
    });
    sns.on(ListSubscriptionsByTopicCommand, { TopicArn: topicArn, NextToken: "page-2" }).resolves({
      Subscriptions: subscriptions.slice(3),
    });
    sns.on(UnsubscribeCommand).resolves({});
  });

  const removed = () => sns.commandCalls(UnsubscribeCommand).map((call) => call.args[0].input.SubscriptionArn);

  it("removes only this connection's HTTPS subscriptions, across pages", async () => {
    await providerWith(pullSettings).removeEventSubscriptions(connectionId, "push");

    assert.deepEqual(removed(), [`${topicArn}:a`, `${topicArn}:b`]);
  });

  it("removes only this connection's queue subscription", async () => {
    await providerWith(pullSettings).removeEventSubscriptions(connectionId, "pull");

    assert.deepEqual(removed(), [`${topicArn}:d`]);
  });
});

describe("queue operations", () => {
  it("long-polls with clamped limits, passes the abort signal, and parses bodies", async () => {
    sqs.on(ReceiveMessageCommand).resolves({
      Messages: [
        { MessageId: "m1", ReceiptHandle: "r1", Body: '{"Type":"Notification"}', Attributes: { ApproximateReceiveCount: "3" } },
        { MessageId: "m2", ReceiptHandle: "r2", Body: "not json" },
        { MessageId: "m3", Body: "{}" },
      ],
    });
    const controller = new AbortController();

    const messages = await providerWith(pullSettings).receiveEventMessages({
      maxMessages: 50,
      waitSeconds: 60,
      signal: controller.signal,
    });

    const [call] = sqs.commandCalls(ReceiveMessageCommand);
    assert.deepEqual(call!.args[0].input, {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    });
    const [, options] = call!.args as unknown as [unknown, { abortSignal?: AbortSignal } | undefined];
    assert.equal(options?.abortSignal, controller.signal);
    assert.deepEqual(messages, [
      { id: "m1", receipt: "r1", body: { Type: "Notification" }, receiveCount: 3 },
      { id: "m2", receipt: "r2", body: null, receiveCount: 1 },
    ]);
  });

  it("deletes in batches of ten and reports the receipts that failed", async () => {
    sqs.on(DeleteMessageBatchCommand).callsFake((input: { Entries: { Id: string }[] }) => ({
      Successful: input.Entries.filter((entry) => entry.Id !== "1").map((entry) => ({ Id: entry.Id })),
      Failed: input.Entries.filter((entry) => entry.Id === "1").map((entry) => ({
        Id: entry.Id,
        Code: "ReceiptHandleIsInvalid",
        SenderFault: true,
      })),
    }));
    const receipts = Array.from({ length: 12 }, (_, index) => `r${index}`);

    const result = await providerWith(pullSettings).deleteEventMessages(receipts);

    const batches = sqs.commandCalls(DeleteMessageBatchCommand).map((call) => call.args[0].input.Entries!.length);
    assert.deepEqual(batches, [10, 2]);
    assert.deepEqual(result, { failed: ["r1", "r11"] });
  });

  it("reads backlog and dead-letter counts and redrives the dead-letter queue", async () => {
    sqs.on(GetQueueAttributesCommand, { QueueUrl: queueUrl }).resolves({ Attributes: { ApproximateNumberOfMessages: "4" } });
    sqs.on(GetQueueAttributesCommand, { QueueUrl: deadLetterUrl }).resolves({ Attributes: { ApproximateNumberOfMessages: "2" } });
    sqs.on(StartMessageMoveTaskCommand).resolves({ TaskHandle: "task" });

    const stats = await providerWith(pullSettings).getEventQueueStats();
    await providerWith(pullSettings).redriveEventMessages();

    assert.deepEqual(stats, { backlog: 4, deadLetters: 2 });
    assert.deepEqual(sqs.commandCalls(StartMessageMoveTaskCommand)[0]!.args[0].input, { SourceArn: deadLetterArn });
  });

  it("refuses queue operations before pull mode is set up", async () => {
    for (const operation of [
      () => providerWith().receiveEventMessages({ maxMessages: 10, waitSeconds: 10 }),
      () => providerWith().deleteEventMessages(["r1"]),
      () => providerWith().getEventQueueStats(),
      () => providerWith().redriveEventMessages(),
    ]) {
      await assert.rejects(operation(), (error) => error instanceof ProviderRejectedError);
    }
    assert.equal(sqs.calls().length, 0);
  });
});
