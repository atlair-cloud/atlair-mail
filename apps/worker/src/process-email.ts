import { parseMailbox } from "@atlair-mail/core";
import { markEmailFailed, markEmailSent, requeueEmail, type Executor } from "@atlair-mail/db";
import type { Email } from "@atlair-mail/db/schema";
import {
  ProviderError,
  ProviderRejectedError,
  ProviderTimeoutError,
  type EmailAddress,
  type EmailMessage,
  type EmailProvider,
} from "@atlair-mail/providers";
import type { Logger } from "pino";
import { runPreSendChecks } from "./pre-send-checks.ts";
import { emailIdTag, errorCodes, maxAttempts, retryDelaysSeconds } from "./settings.ts";

export interface ProcessEmailDeps {
  db: Executor;
  logger: Logger;
  loadProvider: (organizationId: string) => Promise<EmailProvider | null>;
}

export type EmailOutcome = "sent" | "requeued" | "failed";

class InvalidStoredAddressError extends Error {}

function toAddress(stored: string): EmailAddress {
  const mailbox = parseMailbox(stored);
  if (!mailbox) throw new InvalidStoredAddressError();
  return mailbox.name ? { name: mailbox.name, address: mailbox.address } : { address: mailbox.address };
}

export function toMessage(email: Email): EmailMessage {
  return {
    from: toAddress(email.fromAddress),
    to: email.toAddresses.map(toAddress),
    cc: email.ccAddresses.map(toAddress),
    bcc: email.bccAddresses.map(toAddress),
    replyTo: email.replyToAddresses.map(toAddress),
    subject: email.subject,
    html: email.htmlBody ?? undefined,
    text: email.textBody ?? undefined,
    headers: email.headers,
    tags: [...email.tags, { name: emailIdTag, value: email.id }],
  };
}

export function retryDelaySeconds(attempt: number, random = Math.random) {
  const base = retryDelaysSeconds[Math.min(attempt, retryDelaysSeconds.length) - 1] ?? retryDelaysSeconds[0];
  return Math.round(base * (0.8 + random() * 0.4));
}

export async function processEmail(email: Email, deps: ProcessEmailDeps): Promise<EmailOutcome> {
  const { db, logger } = deps;
  const log = logger.child({ emailId: email.id, organizationId: email.organizationId, attempt: email.attemptCount });

  const fail = async (code: string) => {
    await markEmailFailed(db, email.id, code);
    log.warn({ outcome: "failed", errorCode: code }, "email failed");
    return "failed" as const;
  };

  const retryOrFail = async (code: string) => {
    if (email.attemptCount >= maxAttempts) return fail(code);
    const delay = retryDelaySeconds(email.attemptCount);
    await requeueEmail(db, email.id, { sendAt: new Date(Date.now() + delay * 1_000), lastError: code });
    log.info({ outcome: "requeued", errorCode: code, retryInSeconds: delay }, "email requeued");
    return "requeued" as const;
  };

  let message: EmailMessage;
  let provider: EmailProvider | null;
  try {
    message = toMessage(email);
    provider = await deps.loadProvider(email.organizationId);
    const failure = await runPreSendChecks({
      db,
      email,
      provider,
      recipients: [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])],
    });
    if (failure) return fail(failure);
  } catch (error) {
    if (error instanceof InvalidStoredAddressError) return fail(errorCodes.invalidAddress);
    log.error({ err: error }, "email preparation failed");
    return retryOrFail(errorCodes.workerError);
  }

  try {
    const { providerMessageId } = await provider!.send(message);
    await markEmailSent(db, email.id, providerMessageId);
    log.info({ outcome: "sent", providerMessageId }, "email sent");
    return "sent";
  } catch (error) {
    if (error instanceof ProviderRejectedError) return fail(error.code);
    if (error instanceof ProviderTimeoutError || !(error instanceof ProviderError)) {
      return fail(errorCodes.unknownOutcome);
    }
    return error.retryable ? retryOrFail(error.code) : fail(error.code);
  }
}
