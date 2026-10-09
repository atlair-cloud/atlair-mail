# Provider events

How delivered, bounced and complained reach atlair-mail. For what an event does to an email's
status, see [email-lifecycle.md](email-lifecycle.md).

There are two delivery modes. Both run every message through the same checks and the same
recorder (`handleProviderMessage` in `packages/core`).

| | push | pull |
| --- | --- | --- |
| How | The provider calls `POST /webhooks/provider-events/:connectionId` | The worker reads a queue in your provider account |
| Needs a public HTTPS address | yes | no |
| Server down for an hour | SNS retries for a short time, then drops the event | Events wait in the queue for up to 14 days |
| Set up with | `{"url": "https://mail.example.com"}` | `{"mode": "pull"}` |

Use pull for laptops, home servers and anything behind NAT or that restarts. Use push (optionally
behind a Cloudflare Tunnel, see below) for an always-on server that should not poll.

```
provider ──▶ notification topic ──HTTPS──▶ POST /webhooks/provider-events/:connectionId
   (SES)         (SNS)                      ├─ topic must be the connection's topic
                                            ├─ signature (SNS v1/v2) must verify
                                            ├─ SubscriptionConfirmation ─▶ ConfirmSubscription
                                            └─ Notification ─▶ ProviderEvent ─▶ emailEvents.record
```

## Setup

1. Connect the provider with `PUT /v1/provider`. Events start out `disabled`.
2. Register this server's public HTTPS address:

   ```bash
   curl -X POST https://mail.example.com/v1/provider/events \
     -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"url": "https://mail.example.com"}'
   ```

   atlair-mail sets up the provider and subscribes `<url>/webhooks/provider-events/<connection id>`.
   The connection now shows `events.status: "pending_confirmation"`.
3. Within seconds SNS sends a signed confirmation to that address; atlair-mail confirms it and the
   status becomes `confirmed` with `confirmedAt`. If it stays pending, the address does not reach
   this server (see the API log). SNS deletes subscriptions still pending after three days.

`url` rules: `https://`, a registrable domain (no IP addresses, `localhost`, `.internal` or
single-label hosts), no user name or password, no query or fragment, at most 2048 characters. A
path prefix is kept, for example `https://example.com/mail` behind a reverse proxy. Hosts are
lowercased and trailing slashes removed.

| Call | Effect |
| --- | --- |
| Same `url` again | Repairs the provider setup; stays `confirmed`. |
| New `url` | Re-subscribes; back to `pending_confirmation` until confirmed. |
| `PUT /v1/provider` (replace the connection) | Events become `disabled`; register the URL again. |

For SES this creates, in the connection's region:

| Resource | Name | Purpose |
| --- | --- | --- |
| SNS topic | `atlair-mail-events` | Receives events. Its policy lets only `ses.amazonaws.com` publish, and only for this account's `atlair-mail` configuration set (`AWS:SourceAccount`, `AWS:SourceArn`). |
| Configuration set | `atlair-mail` | Every send uses it, so SES publishes events for it. |
| Event destination | `atlair-mail-events` | Send, reject, bounce, complaint, delivery and delivery delay go to the topic. |
| HTTPS subscription | `<url>/webhooks/provider-events/<connection id>` | Confirmed by atlair-mail as soon as SNS sends the confirmation. |

The topic ARN and configuration set name are stored in the connection's settings and never
returned by the API. Open and click tracking are not enabled.

## Pull mode

```
provider ──▶ notification topic ──▶ queue "atlair-mail-events-<connection id>"  (encrypted, 14 days)
   (SES)         (SNS)                 └─ after 10 receives without delete ─▶ "…-dlq" (14 days)
worker: claim the connection (Postgres lease) ─▶ receive (10s long poll, up to 10 messages)
        ─▶ topic, signature, account checks ─▶ emailEvents.record commits ─▶ delete the message
```

```bash
curl -X POST https://mail.example.com/v1/provider/events \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"mode": "pull"}'
```

The connection shows `events.mode: "pull"` and `status: "confirmed"` straight away (SNS confirms a
queue subscription created by the topic owner at once). The worker starts reading within a second.
`GET /v1/provider` then shows `lastReceivedAt`, `backlog` and `deadLetters` (refreshed every five
minutes), and `status: "failing"` with `lastError` while the queue cannot be read.

For SES this adds, next to the topic and configuration set above:

| Resource | Name | Purpose |
| --- | --- | --- |
| SQS queue | `atlair-mail-events-<connection id>` | Holds events. Encrypted with SQS-managed keys, 14-day retention, 120s visibility timeout, 10s long polling. Its policy lets only `sns.amazonaws.com` send, only from this topic (`aws:SourceArn`) and account (`aws:SourceAccount`), and denies any request not over TLS. |
| Dead-letter queue | `atlair-mail-events-<connection id>-dlq` | Receives a message after 10 failed receives. Only the event queue may redrive into it. |
| Queue subscription | the queue's ARN | Raw delivery off, so each message keeps its SNS signature. |

One queue per connection, not per AWS account: organizations sharing an AWS account never read each
other's queue.

### What happens to each message

| Message | Result |
| --- | --- |
| Valid event | Recorded, then deleted. |
| Event for an unknown email, `UnsubscribeConfirmation`, other harmless types | Deleted. |
| `SubscriptionConfirmation` | Confirmed with `ConfirmSubscription` (never `SubscribeURL`), then deleted. |
| Wrong topic, bad signature, wrong account, not JSON | **Kept.** It returns after the visibility timeout and moves to the dead-letter queue after 10 receives, for inspection. A certificate download that fails for a moment looks like a bad signature, so nothing is deleted on a verification failure. |
| The database fails while recording | Kept; it returns after the visibility timeout. |
| Recorded, but the delete fails or the worker dies | Delivered again and ignored as a duplicate by the event key. |

The worker only reads from the queue after taking the connection's lease in Postgres, so a database
outage never uses up receive counts. Events can arrive out of order and more than once; the status
is computed from all events, so neither matters.

### Dead letters

`deadLetters` counts events set aside after 10 failed receives. Fix the cause (usually missing
permissions or a replaced topic), then move them back:

```bash
curl -X POST https://mail.example.com/v1/provider/events/redrive -H "Authorization: Bearer $KEY"
```

This starts an SQS message move task back to the event queue and returns `202`. Only one move can
run per queue at a time. Retention in a dead-letter queue counts from when SNS first delivered the
message, so a message that spent 13 days failing has one day left.

### Switching modes

| Switch | What happens |
| --- | --- |
| push → pull | The queue subscription is created first; the HTTPS subscription is removed once the queue subscription is active. Events that arrive through both meanwhile are deduplicated. |
| pull → push | The HTTPS subscription is created and waits for confirmation. The queue subscription stays until then, and the worker keeps reading the queue until it is empty. |

Only this connection's subscriptions are touched: HTTPS endpoints ending in its id and its own queue.

### Failures and back-off

If the queue cannot be read (missing permission, deleted queue, revoked key), the worker backs off
for that connection only: 30s, 60s, 2m and so on up to 15 minutes. `lastError` holds the code, for
example `ATL_PROVIDER_REJECTED: AccessDenied`. The next successful poll clears it. Deleting a queue
and creating it again within 60 seconds fails with `ATL_PROVIDER_UNAVAILABLE: QueueDeletedRecently`;
run the setup again after a minute.

`PUT /v1/provider` with new credentials or a new region turns events off. The old queues stay in
the old account; delete them there if no longer needed. `DELETE /v1/provider` does not delete them
either: anything unread stays until it expires.

### Cost

Idle, one queue is about 260,000 receive requests a month (one 10-second long poll at a time), plus
one request per event batch. The SQS free tier covers one million requests a month.

## Local development

The simplest option is pull mode: `{"mode": "pull"}` needs nothing public, and events wait in the
queue while your laptop sleeps.

For push mode, SNS needs a public HTTPS URL. A quick tunnel (`cloudflared tunnel --url
http://localhost:8080` or `ngrok http 8080`) prints a new address each time; register it with
`POST /v1/provider/events`. When the address changes, register the new one; the old subscription
then fails and SNS stops retrying it.

**Cloudflare Tunnel with a fixed hostname.** If your domain is on Cloudflare, a named tunnel keeps
the same address across restarts:

```bash
cloudflared tunnel login
cloudflared tunnel create atlair-mail
cloudflared tunnel route dns atlair-mail mail-events.example.com
cloudflared tunnel run --url http://localhost:8080 atlair-mail
```

Register `https://mail-events.example.com` once. Events sent while the tunnel or server is down are
still dropped by SNS after its short retry window; use pull mode if that matters.

Send to the [mailbox simulator](deliverability.md#testing-without-hurting-reputation) to produce
delivery, bounce and complaint events, then read them with `GET /v1/emails/:id/events`.

## Security

Push mode:

| Threat | Control |
| --- | --- |
| Anyone can POST to the URL | No API key, so nothing is trusted until verified. The `TopicArn` must equal the topic stored for the connection in the URL; this cheap check runs first so junk never causes a certificate download. |
| Forged messages | The SNS signature is checked with `sns-payload-validator` (SignatureVersion 1 or 2, certificate URL must be `https://sns.<region>.amazonaws.com/SimpleNotificationService-<id>.pem`, certificates cached). The check gives up after 5 seconds. |
| Someone else's AWS account | A valid signature only proves SNS sent the message, not whose topic it is. Matching the stored topic ARN closes that, and the event's `sendingAccountId` must be the topic's account. |
| Fetching attacker-chosen URLs | `SubscribeURL` is never fetched. The subscription is confirmed with the `ConfirmSubscription` API using the connection's own credentials. atlair-mail never requests the registered `url` either; only the provider does. |
| Pointing events elsewhere | Only `full_access` keys can register a `url`, and it only subscribes a topic in that organization's own provider account. The host must be a public registrable domain, and the path is always ours. The URL comes from the request body, never from `Host` or `X-Forwarded-*` headers. |
| Unsubscribing us | Confirmation sets `AuthenticateOnUnsubscribe`, so only the topic owner can unsubscribe. |
| Cross-tenant writes | The organization comes from the connection, and events are applied only to that organization's emails. |
| Large or abusive requests | 256 KB body limit (the SNS maximum), JSON parsed with Fastify's safe parser (`__proto__` rejected), 3000 requests per IP per minute. |
| Replays | Events are idempotent (see [email-lifecycle.md](email-lifecycle.md)). |
| Logs | Connection id, organization, email id, event type and outcome only; rejections log the reason. Addresses, subjects and tokens are not logged. |

Responses: `204` once handled (including events for unknown emails, so SNS does not retry them),
`403 ATL_PROVIDER_EVENT_UNVERIFIED`, `404` for an unknown connection, `400` for invalid JSON, `413`
over 256 KB. Anything else is a `5xx`, which SNS retries.

Behind a reverse proxy, the per-IP limit sees the proxy's address unless Fastify's `trustProxy` is
configured for it.

Pull mode:

| Threat | Control |
| --- | --- |
| Someone sends to the queue | Queue policy: only `sns.amazonaws.com`, only from this topic and account. Every message is still checked exactly as in push mode. |
| Data at rest | Both queues use SQS-managed encryption; messages contain email addresses. Plain-HTTP requests are denied. |
| Organizations sharing an AWS account | Each connection has its own queue; subscription changes only touch this connection's subscriptions. |
| Losing events | Deleted only after the event commits. Kept on any failure, then set aside in the dead-letter queue, which can be redriven. |
| Poll storms | One poller per connection (Postgres lease), at most 20 connections polled at once per worker, back-off on errors. |
| Leaking AWS details | Queue URLs contain the account id and are never returned by the API. Logs hold ids, counts, outcomes and codes, never message bodies, addresses or receipt handles. |
