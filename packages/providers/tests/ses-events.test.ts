import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { providerEventKey } from "../src/index.ts";
import { parseSesEvent } from "../src/ses/ses-events.ts";

const emailId = "01a11ca2-c72a-701c-940c-0fa9badc0f5a";

const mail = {
  timestamp: "2026-10-09T10:00:00.000Z",
  source: "hello@mail.example.com",
  sourceArn: "arn:aws:ses:ap-south-1:123456789012:identity/mail.example.com",
  sendingAccountId: "123456789012",
  messageId: "010901a11ca2cbbd-0000",
  destination: ["ada@example.org", "bob@example.org"],
  headersTruncated: false,
  headers: [{ name: "Subject", value: "Welcome" }],
  commonHeaders: { subject: "Welcome", from: ["hello@mail.example.com"] },
  tags: {
    "ses:configuration-set": ["atlair-mail"],
    atlair_email_id: [emailId],
  },
};

describe("parseSesEvent", () => {
  it("parses a delivery with the recipients, SMTP response and email id tag", () => {
    const parsed = parseSesEvent({
      eventType: "Delivery",
      mail,
      delivery: {
        timestamp: "2026-10-09T10:00:02.000Z",
        processingTimeMillis: 2000,
        recipients: ["ada@example.org"],
        smtpResponse: "250 2.6.0 Message received",
        reportingMTA: "a8-70.smtp-out.amazonses.com",
        remoteMtaIp: "203.0.113.10",
      },
    });

    const occurredAt = new Date("2026-10-09T10:00:02.000Z");
    assert.deepEqual(parsed, {
      accountId: "123456789012",
      event: {
        eventKey: providerEventKey({
          providerMessageId: mail.messageId,
          type: "delivered",
          occurredAt,
          recipients: [{ address: "ada@example.org" }],
        }),
        providerMessageId: mail.messageId,
        emailId,
        type: "delivered",
        occurredAt,
        details: { recipients: [{ address: "ada@example.org" }], smtpResponse: "250 2.6.0 Message received" },
      },
    });
  });

  it("parses permanent and transient bounces per recipient", () => {
    const bounce = (bounceType: string, bounceSubType: string) =>
      parseSesEvent({
        eventType: "Bounce",
        mail,
        bounce: {
          bounceType,
          bounceSubType,
          bouncedRecipients: [
            {
              emailAddress: "bob@example.org",
              action: "failed",
              status: "5.1.1",
              diagnosticCode: "smtp; 550 5.1.1 user unknown",
            },
          ],
          timestamp: "2026-10-09T10:00:03.000Z",
          feedbackId: "0100-feedback",
          reportingMTA: "dsn; e1.smtp-out.amazonses.com",
        },
      })!.event;

    const permanent = bounce("Permanent", "General");
    const transient = bounce("Transient", "MailboxFull");
    const unknown = bounce("Undetermined", "Undetermined");

    assert.equal(permanent.type, "bounced");
    assert.deepEqual(permanent.details, {
      recipients: [{ address: "bob@example.org", diagnosticCode: "smtp; 550 5.1.1 user unknown" }],
      bounce: { kind: "permanent", subType: "General" },
    });
    assert.deepEqual(transient.details.bounce, { kind: "transient", subType: "MailboxFull" });
    assert.deepEqual(unknown.details.bounce, { kind: "undetermined", subType: "Undetermined" });
  });

  it("parses complaints without keeping the user agent", () => {
    const { event } = parseSesEvent({
      eventType: "Complaint",
      mail,
      complaint: {
        complainedRecipients: [{ emailAddress: "ada@example.org" }],
        timestamp: "2026-10-09T11:00:00.000Z",
        feedbackId: "0100-complaint",
        userAgent: "Mozilla/5.0",
        complaintFeedbackType: "abuse",
        arrivalDate: "2026-10-09T10:59:00.000Z",
      },
    })!;

    assert.equal(event.type, "complained");
    assert.deepEqual(event.details, { recipients: [{ address: "ada@example.org" }], complaint: { feedbackType: "abuse" } });
  });

  it("uses the mail destination and time for send and reject", () => {
    const sent = parseSesEvent({ eventType: "Send", mail, send: {} })!.event;
    const rejected = parseSesEvent({ eventType: "Reject", mail, reject: { reason: "Bad content" } })!.event;

    assert.equal(sent.type, "sent");
    assert.equal(rejected.type, "rejected");
    assert.deepEqual(sent.occurredAt, new Date(mail.timestamp));
    assert.deepEqual(
      sent.details.recipients.map((recipient) => recipient.address),
      mail.destination,
    );
  });

  it("parses delays, opens and clicks without IP addresses or user agents", () => {
    const delayed = parseSesEvent({
      eventType: "DeliveryDelay",
      mail,
      deliveryDelay: {
        timestamp: "2026-10-09T10:05:00.000Z",
        delayType: "MailboxFull",
        expirationTime: "2026-10-10T10:00:00.000Z",
        delayedRecipients: [{ emailAddress: "bob@example.org", status: "4.2.2", diagnosticCode: "452 4.2.2 full" }],
      },
    })!.event;
    const clicked = parseSesEvent({
      eventType: "Click",
      mail,
      click: {
        ipAddress: "198.51.100.7",
        timestamp: "2026-10-09T10:10:00.000Z",
        userAgent: "Mozilla/5.0",
        link: "https://example.org/welcome",
        linkTags: {},
      },
    })!.event;
    const opened = parseSesEvent({
      eventType: "Open",
      mail,
      open: { ipAddress: "198.51.100.7", timestamp: "2026-10-09T10:09:00.000Z", userAgent: "Mozilla/5.0" },
    })!.event;

    assert.equal(delayed.type, "delivery_delayed");
    assert.deepEqual(delayed.details.recipients, [{ address: "bob@example.org", diagnosticCode: "452 4.2.2 full" }]);
    assert.deepEqual(clicked.details, {
      recipients: [{ address: "ada@example.org" }, { address: "bob@example.org" }],
      link: "https://example.org/welcome",
    });
    assert.equal(opened.type, "opened");
    assert.doesNotMatch(JSON.stringify([delayed, clicked, opened]), /198\.51|Mozilla/);
  });

  it("accepts the notificationType field used by identity notifications", () => {
    const parsed = parseSesEvent({
      notificationType: "Delivery",
      mail: { ...mail, tags: undefined },
      delivery: { timestamp: "2026-10-09T10:00:02.000Z", recipients: ["ada@example.org"] },
    });

    assert.equal(parsed?.event.type, "delivered");
    assert.equal(parsed?.event.emailId, undefined);
  });

  it("returns null for unsupported or malformed events", () => {
    assert.equal(parseSesEvent(null), null);
    assert.equal(parseSesEvent("Delivery"), null);
    assert.equal(parseSesEvent({ eventType: "Rendering Failure", mail }), null);
    assert.equal(parseSesEvent({ eventType: "Subscription", mail }), null);
    assert.equal(parseSesEvent({ eventType: "Delivery" }), null);
    assert.equal(parseSesEvent({ eventType: "Delivery", mail: { ...mail, messageId: 42 } }), null);
    assert.equal(
      parseSesEvent({ eventType: "Delivery", mail: { ...mail, timestamp: "never" }, delivery: { timestamp: "nope" } }),
      null,
    );
    assert.equal(parseSesEvent({ eventType: "__proto__", mail }), null);
    assert.equal(parseSesEvent({ eventType: "toString", mail }), null);
  });

  it("skips malformed recipients", () => {
    const { event } = parseSesEvent({
      eventType: "Bounce",
      mail,
      bounce: {
        bounceType: "Permanent",
        bounceSubType: "General",
        timestamp: "2026-10-09T10:00:03.000Z",
        bouncedRecipients: [{ emailAddress: "bob@example.org" }, { emailAddress: 7 }, null, "x"],
      },
    })!;

    assert.deepEqual(event.details.recipients, [{ address: "bob@example.org" }, { address: "x" }]);
  });
});
