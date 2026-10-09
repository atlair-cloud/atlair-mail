# Webhooks

atlair-mail POSTs email events to your HTTPS endpoints: delivered, bounced, complained and so on.
Requests follow [Standard Webhooks](https://www.standardwebhooks.com/), so any of its libraries can
verify them.

```
provider event ──▶ email_events + webhook_deliveries (one transaction, the outbox)
                     └─ worker claims due deliveries ──signed POST──▶ your endpoint
                          └─ 2xx: delivered · otherwise retry with backoff · failed after 8 attempts
```

## Endpoints

All routes need a `full_access` key and only see the caller's organization.

| Route | |
| --- | --- |
| `POST /v1/webhooks` `{ "url", "eventTypes": ["email.delivered", …] }` | Creates an endpoint: `201` with `signingSecret` (`whsec_…`). **The secret is shown only here.** |
| `GET /v1/webhooks` | Lists endpoints. |
| `GET /v1/webhooks/:id` | One endpoint, without the secret. |
| `PATCH /v1/webhooks/:id` `{ "url"?, "eventTypes"?, "enabled"? }` | Changes the endpoint. Disabled endpoints receive nothing. |
| `DELETE /v1/webhooks/:id` | `204`. Also deletes its delivery history and anything still pending. |
| `GET /v1/webhooks/:id/deliveries` | Newest first: status, attempts, next attempt, last response code and error. `limit` (1–100) and `before` (last `id` of the previous page). |

At most 20 endpoints per organization (`409 ATL_WEBHOOK_LIMIT`).

**URL rules.** The URL must be `https://` on a public, registered domain. It may have a path and a query
string, such as a token. It can't have credentials or a fragment, and can't point at an IP address,
`localhost` or an internal name (`400 ATL_INVALID_WEBHOOK_URL`). When testing locally, expose your
receiver through a tunnel such as cloudflared or ngrok.

## Event types

| Type | When |
| --- | --- |
| `email.sent` | The provider accepted the email. |
| `email.delivered` | A recipient's mail server accepted it. |
| `email.delivery_delayed` | Delivery is being retried by the provider. |
| `email.bounced` | A recipient bounced. `bounce.kind` is `permanent`, `transient` or `undetermined`. |
| `email.complained` | A recipient reported spam. |
| `email.rejected` | The provider refused it after accepting the request. |
| `email.failed` | atlair-mail gave up before or while handing it to the provider. `data.error` says why. |
| `email.opened`, `email.clicked` | Engagement, when tracking is enabled at the provider. |

One delivery is made per provider event, so an email to three people can produce three
`email.delivered` deliveries, one per recipient report.

## Payload

```json
{
  "type": "email.bounced",
  "createdAt": "2026-10-09T10:00:00.000Z",
  "data": {
    "emailId": "0199c7c2-…",
    "from": "Acme <hello@mail.acme.com>",
    "to": ["ada@example.org", "bob@example.org"],
    "subject": "Welcome",
    "recipients": [{ "address": "bob@example.org", "diagnosticCode": "smtp; 550 5.1.1 user unknown" }],
    "bounce": { "kind": "permanent", "subType": "General" }
  }
}
```

`createdAt` is when the provider saw the event, or when atlair-mail failed the email. `recipients` lists the addresses the event is about.
`bounce`, `complaint`, `smtpResponse` and `link` appear when they apply. The payload is fixed when the
event arrives, so every retry sends the same bytes.

### `email.failed`

Sent once per email, in the same transaction that sets its status to `failed`. `recipients` is empty
and `data.error` is one of:

| `error` | Meaning |
| --- | --- |
| `ATL_RECIPIENT_SUPPRESSED` | A recipient was suppressed after the email was queued. |
| `ATL_DOMAIN_NOT_VERIFIED` | The From domain is no longer verified. |
| `ATL_PROVIDER_NOT_CONNECTED` | No provider is connected. |
| `ATL_INVALID_ADDRESS` | A stored address could not be parsed. |
| `ATL_PROVIDER_REJECTED: <Reason>` | The provider refused the send request. |
| `ATL_PROVIDER_THROTTLED: <Reason>`, `ATL_PROVIDER_UNAVAILABLE: <Reason>` | Still failing after the last retry. |
| `ATL_PROVIDER_TIMEOUT`, `ATL_WORKER_LEASE_EXPIRED` | The outcome is unknown, so the email is not resent. |

`<Reason>` is a short provider error name such as `MessageRejected`, never a provider message. After
`ATL_PROVIDER_TIMEOUT` or `ATL_WORKER_LEASE_EXPIRED` the provider may still have sent the email: a
later `email.delivered`, `email.bounced` or `email.complained` can follow and moves the status on.

## Verifying requests

Each request has three headers:

| Header | |
| --- | --- |
| `webhook-id` | The delivery id. The same on every retry: use it to drop duplicates. |
| `webhook-timestamp` | Unix seconds of this attempt. |
| `webhook-signature` | `v1,<base64 HMAC-SHA256 of "<id>.<timestamp>.<raw body>">`, keyed with the base64 part of the secret. |

Verify against the **raw** body, before parsing it:

```ts
import { Webhook } from "standardwebhooks";

const wh = new Webhook(process.env.ATLAIR_WEBHOOK_SECRET);
const event = wh.verify(rawBody, {
  "webhook-id": req.headers["webhook-id"],
  "webhook-timestamp": req.headers["webhook-timestamp"],
  "webhook-signature": req.headers["webhook-signature"],
});
```

`verify` throws on a bad signature or a timestamp more than 5 minutes off, which stops replays.

## Retries

Any `2xx` within 15 seconds counts as delivered. The response body is ignored. Redirects are not
followed: a `3xx` is a failed attempt.

| Attempt | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| After the previous one | now | 5s | 5m | 30m | 2h | 5h | 10h | 10h |

About 27 hours in all, the same schedule Svix and Resend use. After attempt 8 the delivery is
`failed` and kept for inspection. Deliveries for a disabled endpoint fail without being sent.
Delivery is **at least once**, so make your handler idempotent on `webhook-id`.

Error codes in `lastError`:

| Code | Meaning |
| --- | --- |
| `ATL_WEBHOOK_HTTP_ERROR` | Your endpoint answered with a non-2xx status (`lastResponseStatus`). |
| `ATL_WEBHOOK_TIMEOUT` | No response within 15 seconds. |
| `ATL_WEBHOOK_CONNECTION_FAILED` | DNS, TLS or TCP failure. |
| `ATL_WEBHOOK_BLOCKED_ADDRESS` | The hostname resolved to a private, loopback, link-local or metadata address. |
| `ATL_WEBHOOK_ENDPOINT_DISABLED` | The endpoint was disabled before the delivery was sent. |
| `ATL_WEBHOOK_SECRET_UNAVAILABLE` | The signing secret could not be decrypted, for example after an encryption key was removed. |

## How it works

- **Outbox.** `emailEvents.record()` inserts the provider event and one `webhook_deliveries` row per
  enabled, subscribed endpoint in the same transaction. A crash or restart can't lose a delivery, and
  a duplicate provider event queues nothing.
- **Claim.** The worker's dispatcher loop claims due rows with `FOR UPDATE SKIP LOCKED`, pushes
  `next_attempt_at` 60s ahead as a lease and increments `attempt_count`. The HTTP call happens
  outside any transaction. If the worker dies, the row becomes due again when the lease ends.
- **Result.** It is saved only if `attempt_count` still matches the claim, so a worker whose lease
  already ended cannot overwrite a newer attempt.

## Security

| Concern | Control |
| --- | --- |
| SSRF | URL rules when saved, plus [request-filtering-agent](https://github.com/azu/request-filtering-agent) checking the resolved IP on every connection (covers DNS rebinding). No redirects. |
| Forged or replayed requests | HMAC-SHA256 signature over id, timestamp and body; receivers reject old timestamps. |
| Secret exposure | 32 random bytes, encrypted with `CREDENTIALS_ENCRYPTION_KEYS` and bound to the organization; returned once; never logged. |
| Slow or hostile receivers | 15s timeout, body never read, 10 deliveries in flight per worker, no database locks held during HTTP. |
| Tenant isolation | Deliveries fan out only to the event's organization; every route filters by it. |
| Personal data in logs | Only delivery id, endpoint id, attempt, status and error code are logged. |
