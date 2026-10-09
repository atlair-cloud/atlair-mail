import {
  CreateQueueCommand,
  DeleteMessageBatchCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  QueueDoesNotExist,
  ReceiveMessageCommand,
  SetQueueAttributesCommand,
  StartMessageMoveTaskCommand,
  type QueueAttributeName,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import {
  ListSubscriptionsByTopicCommand,
  SubscribeCommand,
  UnsubscribeCommand,
  type SNSClient,
  type Subscription,
} from "@aws-sdk/client-sns";
import type { EventDeliveryMode, EventMessage, EventQueueStats, ReceiveEventsOptions } from "../types.ts";

export const eventQueueSettings = {
  visibilityTimeoutSeconds: 120,
  retentionSeconds: 1_209_600,
  receiveWaitSeconds: 10,
  maxReceiveCount: 10,
  deleteBatchSize: 10,
} as const;

export const eventQueueName = (connectionId: string) => `atlair-mail-events-${connectionId}`;

export const deadLetterQueueName = (connectionId: string) => `${eventQueueName(connectionId)}-dlq`;

const queueNameOf = (queueUrl: string) => queueUrl.slice(queueUrl.lastIndexOf("/") + 1);

export function queueArn(topicArn: string, queueName: string) {
  const [, partition, , region, account] = topicArn.split(":");
  return `arn:${partition}:sqs:${region}:${account}:${queueName}`;
}

export const queueArnOfUrl = (topicArn: string, queueUrl: string) => queueArn(topicArn, queueNameOf(queueUrl));

const denyInsecureTransport = (resource: string) => ({
  Sid: "DenyInsecureTransport",
  Effect: "Deny",
  Principal: "*",
  Action: "sqs:*",
  Resource: resource,
  Condition: { Bool: { "aws:SecureTransport": "false" } },
});

export function eventQueuePolicy(eventQueueArn: string, topicArn: string) {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowEventTopic",
        Effect: "Allow",
        Principal: { Service: "sns.amazonaws.com" },
        Action: "sqs:SendMessage",
        Resource: eventQueueArn,
        Condition: {
          ArnEquals: { "aws:SourceArn": topicArn },
          StringEquals: { "aws:SourceAccount": topicArn.split(":")[4] },
        },
      },
      denyInsecureTransport(eventQueueArn),
    ],
  });
}

export function deadLetterQueueAttributes(deadLetterArn: string, eventQueueArn: string) {
  return {
    Policy: JSON.stringify({ Version: "2012-10-17", Statement: [denyInsecureTransport(deadLetterArn)] }),
    MessageRetentionPeriod: String(eventQueueSettings.retentionSeconds),
    SqsManagedSseEnabled: "true",
    RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue", sourceQueueArns: [eventQueueArn] }),
  } satisfies Partial<Record<QueueAttributeName, string>>;
}

export function eventQueueAttributes(eventQueueArn: string, deadLetterArn: string, topicArn: string) {
  return {
    Policy: eventQueuePolicy(eventQueueArn, topicArn),
    VisibilityTimeout: String(eventQueueSettings.visibilityTimeoutSeconds),
    MessageRetentionPeriod: String(eventQueueSettings.retentionSeconds),
    ReceiveMessageWaitTimeSeconds: String(eventQueueSettings.receiveWaitSeconds),
    SqsManagedSseEnabled: "true",
    RedrivePolicy: JSON.stringify({
      deadLetterTargetArn: deadLetterArn,
      maxReceiveCount: eventQueueSettings.maxReceiveCount,
    }),
  } satisfies Partial<Record<QueueAttributeName, string>>;
}

export async function ensureQueue(sqs: SQSClient, name: string, attributes: Record<string, string>) {
  try {
    const { QueueUrl: existing } = await sqs.send(new GetQueueUrlCommand({ QueueName: name }));
    if (existing) {
      await sqs.send(new SetQueueAttributesCommand({ QueueUrl: existing, Attributes: attributes }));
      return existing;
    }
  } catch (error) {
    if (!(error instanceof QueueDoesNotExist)) throw error;
  }
  const { QueueUrl: created } = await sqs.send(new CreateQueueCommand({ QueueName: name, Attributes: attributes }));
  if (!created) throw new Error("MissingQueueUrl");
  return created;
}

export async function subscribeQueue(sns: SNSClient, topicArn: string, eventQueueArn: string) {
  const { SubscriptionArn: arn } = await sns.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: eventQueueArn,
      Attributes: { RawMessageDelivery: "false" },
      ReturnSubscriptionArn: true,
    }),
  );
  return typeof arn === "string" && arn.startsWith("arn:");
}

async function listSubscriptions(sns: SNSClient, topicArn: string) {
  const subscriptions: Subscription[] = [];
  let nextToken: string | undefined;
  do {
    const page = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn, NextToken: nextToken }));
    subscriptions.push(...(page.Subscriptions ?? []));
    nextToken = page.NextToken;
  } while (nextToken);
  return subscriptions;
}

export function isOwnSubscription(
  subscription: Subscription,
  connectionId: string,
  mode: EventDeliveryMode,
  topicArn: string,
) {
  if (!subscription.SubscriptionArn?.startsWith("arn:")) return false;
  if (mode === "pull") {
    return subscription.Protocol === "sqs" && subscription.Endpoint === queueArn(topicArn, eventQueueName(connectionId));
  }
  return subscription.Protocol === "https" && (subscription.Endpoint ?? "").endsWith(`/${connectionId}`);
}

export async function removeSubscriptions(
  sns: SNSClient,
  topicArn: string,
  connectionId: string,
  mode: EventDeliveryMode,
) {
  const own = (await listSubscriptions(sns, topicArn)).filter((subscription) =>
    isOwnSubscription(subscription, connectionId, mode, topicArn),
  );
  for (const subscription of own) {
    await sns.send(new UnsubscribeCommand({ SubscriptionArn: subscription.SubscriptionArn }));
  }
  return own.length;
}

function parseBody(body: string | undefined): unknown {
  if (body === undefined) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export async function receiveMessages(sqs: SQSClient, queueUrl: string, options: ReceiveEventsOptions) {
  const { Messages: messages = [] } = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: Math.min(Math.max(options.maxMessages, 1), 10),
      WaitTimeSeconds: Math.min(Math.max(options.waitSeconds, 0), 20),
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    }),
    { abortSignal: options.signal },
  );
  return messages.flatMap((message): EventMessage[] =>
    message.MessageId && message.ReceiptHandle
      ? [
          {
            id: message.MessageId,
            receipt: message.ReceiptHandle,
            body: parseBody(message.Body),
            receiveCount: Number(message.Attributes?.ApproximateReceiveCount ?? 1),
          },
        ]
      : [],
  );
}

export async function deleteMessages(sqs: SQSClient, queueUrl: string, receipts: string[]) {
  const failed: string[] = [];
  for (let start = 0; start < receipts.length; start += eventQueueSettings.deleteBatchSize) {
    const batch = receipts.slice(start, start + eventQueueSettings.deleteBatchSize);
    const result = await sqs.send(
      new DeleteMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch.map((receipt, index) => ({ Id: String(index), ReceiptHandle: receipt })),
      }),
    );
    for (const entry of result.Failed ?? []) {
      const receipt = batch[Number(entry.Id)];
      if (receipt !== undefined) failed.push(receipt);
    }
  }
  return { failed };
}

const approximateCount = async (sqs: SQSClient, queueUrl: string) => {
  const { Attributes: attributes } = await sqs.send(
    new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ["ApproximateNumberOfMessages"] }),
  );
  return Number(attributes?.ApproximateNumberOfMessages ?? 0);
};

export async function queueStats(sqs: SQSClient, queueUrl: string, deadLetterUrl: string): Promise<EventQueueStats> {
  const [backlog, deadLetters] = await Promise.all([
    approximateCount(sqs, queueUrl),
    approximateCount(sqs, deadLetterUrl),
  ]);
  return { backlog, deadLetters };
}

export async function redrive(sqs: SQSClient, topicArn: string, deadLetterUrl: string) {
  await sqs.send(new StartMessageMoveTaskCommand({ SourceArn: queueArnOfUrl(topicArn, deadLetterUrl) }));
}
