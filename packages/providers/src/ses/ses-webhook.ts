import Validator from "sns-payload-validator";
import { ProviderEventRejectedError, type ProviderWebhook } from "../webhooks.ts";
import type { SesSettings } from "../types.ts";
import { parseSesEvent } from "./ses-events.ts";

export const snsValidator = new Validator({ maxCerts: 100 });

export const signatureTimeoutMs = 5_000;

export type SignatureVerifier = (message: Record<string, unknown>) => Promise<unknown>;

const verifyWithTimeout: SignatureVerifier = (message) =>
  Promise.race([
    snsValidator.validate(JSON.stringify(message)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("SignatureTimeout")), signatureTimeoutMs).unref()),
  ]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const accountOf = (arn: string) => arn.split(":")[4];

function parseJson(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function readSesWebhook(
  settings: SesSettings,
  body: unknown,
  verify: SignatureVerifier = verifyWithTimeout,
): Promise<ProviderWebhook> {
  if (!isRecord(body)) throw new ProviderEventRejectedError("MalformedMessage");
  const topicArn = settings.eventTopicArn;
  if (!topicArn || body.TopicArn !== topicArn) throw new ProviderEventRejectedError("UnknownTopic");
  try {
    await verify(body);
  } catch (error) {
    throw new ProviderEventRejectedError("InvalidSignature", { cause: error });
  }

  switch (body.Type) {
    case "SubscriptionConfirmation": {
      if (typeof body.Token !== "string" || body.Token.length === 0) {
        throw new ProviderEventRejectedError("MalformedMessage");
      }
      return { kind: "confirm", token: body.Token };
    }
    case "Notification": {
      const parsed = parseSesEvent(parseJson(body.Message));
      if (!parsed) return { kind: "ignored" };
      if (parsed.accountId !== undefined && parsed.accountId !== accountOf(topicArn)) {
        throw new ProviderEventRejectedError("AccountMismatch");
      }
      return { kind: "event", event: parsed.event };
    }
    default:
      return { kind: "ignored" };
  }
}
