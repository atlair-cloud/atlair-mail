# Provider events

How delivered, bounced and complained reach atlair-mail. For what an event does to an email's
status, see [email-lifecycle.md](email-lifecycle.md).

```
provider ──▶ notification topic ──HTTPS──▶ POST /webhooks/provider-events/:connectionId
   (SES)         (SNS)                      ├─ topic must be the connection's topic
                                            ├─ signature (SNS v1/v2) must verify
                                            ├─ SubscriptionConfirmation ─▶ ConfirmSubscription
                                            └─ Notification ─▶ ProviderEvent ─▶ emailEvents.record
```

## Setup

1. Set `PUBLIC_URL` to the API's public HTTPS address, for example `https://mail.example.com`. The
   provider must be able to reach it; `localhost` does not work.
2. Connect the provider with `PUT /v1/provider`. With `PUBLIC_URL` set, atlair-mail also sets up
   events and the response shows `eventsEnabled: true`. If it could not, the connection is still
   saved and `eventsError` says why, for example `ATL_PROVIDER_REJECTED: AuthorizationErrorException`
   for a missing IAM permission.
3. Fix the cause and call `POST /v1/provider/events`. It is safe to run any number of times.

For SES this creates, in the connection's region:

| Resource | Name | Purpose |
| --- | --- | --- |
| SNS topic | `atlair-mail-events` | Receives events. Its policy lets only `ses.amazonaws.com` publish, and only for this account's `atlair-mail` configuration set (`AWS:SourceAccount`, `AWS:SourceArn`). |
| Configuration set | `atlair-mail` | Every send uses it, so SES publishes events for it. |
| Event destination | `atlair-mail-events` | Send, reject, bounce, complaint, delivery and delivery delay go to the topic. |
| HTTPS subscription | `<PUBLIC_URL>/webhooks/provider-events/<connection id>` | Confirmed by atlair-mail as soon as SNS sends the confirmation. |

The topic ARN and configuration set name are stored in the connection's settings and never
returned by the API. Open and click tracking are not enabled.

## Local development

SNS needs a public HTTPS URL. Run a tunnel such as `cloudflared tunnel --url http://localhost:8080`
or `ngrok http 8080`, set `PUBLIC_URL` to the address it prints, restart the API and call
`POST /v1/provider/events`. A new tunnel address needs another call; the old subscription then
fails and SNS stops retrying it.

Send to the [mailbox simulator](deliverability.md#testing-without-hurting-reputation) to produce
delivery, bounce and complaint events, then read them with `GET /v1/emails/:id/events`.

## Security

| Threat | Control |
| --- | --- |
| Anyone can POST to the URL | No API key, so nothing is trusted until verified. The `TopicArn` must equal the topic stored for the connection in the URL; this cheap check runs first so junk never causes a certificate download. |
| Forged messages | The SNS signature is checked with `sns-payload-validator` (SignatureVersion 1 or 2, certificate URL must be `https://sns.<region>.amazonaws.com/SimpleNotificationService-<id>.pem`, certificates cached). The check gives up after 5 seconds. |
| Someone else's AWS account | A valid signature only proves SNS sent the message, not whose topic it is. Matching the stored topic ARN closes that, and the event's `sendingAccountId` must be the topic's account. |
| Fetching attacker-chosen URLs | `SubscribeURL` is never fetched. The subscription is confirmed with the `ConfirmSubscription` API using the connection's own credentials. |
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
