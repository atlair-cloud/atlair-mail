# Worker

`apps/worker` sends queued emails, delivers customer webhooks and reads provider events in pull mode. It is plain Node (no HTTP server)
and shares `packages/db`, `packages/core` and `packages/providers` with the API. Both run on the same
poll loop (`src/poll-loop.ts`): claim up to the free concurrency, process outside any transaction,
sleep when idle.

```bash
cp apps/worker/.env.example apps/worker/.env   # same DATABASE_URL and CREDENTIALS_ENCRYPTION_KEYS as the API
pnpm --filter @atlair-mail/worker dev
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | local compose database | Same database as the API |
| `CREDENTIALS_ENCRYPTION_KEYS` | required | Same keys as the API, to decrypt provider credentials |
| `LOG_LEVEL` | `info` | pino level |
| `WORKER_CONCURRENCY` | `10` | Emails sent at the same time by one process (1–100) |

Everything else is a constant in `src/settings.ts`: poll every 1s, 120s lease, sweep every 30s,
6 attempts, backoff 30s → 2m → 10m → 30m → 1h with ±20% jitter, 25s shutdown grace. Webhooks: 10
in flight, 60s lease, 15s request timeout, 8 attempts (see [webhooks.md](webhooks.md)).

## Lifecycle of one email

```
claim: UPDATE emails SET status='sending', locked_until=now()+120s, attempt_count+1
       WHERE id IN (SELECT id … status='queued' AND send_at<=now() ORDER BY send_at FOR UPDATE SKIP LOCKED)
  └─ pre-send checks (src/pre-send-checks.ts), first failure wins → failed
       provider connected → From domain still verified → no recipient suppressed
  └─ provider.send (withRetry inside, about 5s at most; through the atlair-mail configuration set once events are set up)
       ok                       → sent (provider_message_id, sent_at)
       ATL_PROVIDER_REJECTED    → failed
       THROTTLED / UNAVAILABLE  → queued again with backoff; failed after attempt 6
       ATL_PROVIDER_TIMEOUT     → failed (outcome unknown, never resent)
sweeper: status='sending' AND locked_until < now() → failed (ATL_WORKER_LEASE_EXPIRED), one guarded update per email
every failed → same transaction: failed event + email.failed webhook deliveries (src/email-failures.ts)
```

Every outcome is written with `WHERE status = 'sending'`, so a late writer cannot overwrite a row the
sweeper or another worker already moved. `last_error` holds an error code, never a provider message.

## Delivery guarantee

**At most once when the outcome is unknown.** Sending is not idempotent and SES has no idempotency
key, so a timeout or a worker that died mid-send leaves the email `failed` instead of resending it.
A duplicate email is worse than a visible failure the customer can retry. Every send carries an
`atlair_email_id` tag, so a later `delivered`, `bounced` or `complained` event moves such an email
out of `failed` (see [email-lifecycle.md](email-lifecycle.md)). If an event already moved the email
before the worker wrote `sent`, the worker's guarded update changes nothing.

Cases that are known not to have reached the provider (pre-send failures, throttling, 5xx,
connection refused) are retried or failed explicitly.

## Webhook deliveries

```
claim: UPDATE webhook_deliveries SET next_attempt_at=now()+60s, attempt_count+1
       WHERE id IN (SELECT id … status='pending' AND next_attempt_at<=now() FOR UPDATE SKIP LOCKED)
  └─ endpoint disabled            → failed (ATL_WEBHOOK_ENDPOINT_DISABLED)
  └─ sign (webhook-id = delivery id, fresh timestamp; also with the previous secret during a
     rotation overlap) and POST through request-filtering-agent
       2xx                        → delivered
       anything else, attempt < 8 → pending, next_attempt_at = now + 5s/5m/30m/2h/5h/10h/10h
       attempt 8                  → failed
```

Results are saved `WHERE status='pending' AND attempt_count = <claimed attempt>`. A worker that dies
mid-request leaves the row to come due again when its lease ends, so a receiver may see the same
`webhook-id` twice.

Before claiming, at most every 5 minutes, the dispatcher clears previous signing secrets whose
rotation overlap has ended (`clearExpiredPreviousSecrets`).

## Provider events (pull mode)

`src/event-poller.ts`, on the same poll loop, for connections with `events_poll_after` set:

```
claim: UPDATE provider_connections SET events_poll_after = now()+120s
       WHERE id IN (SELECT id … events_poll_after <= now() ORDER BY events_poll_after FOR UPDATE SKIP LOCKED)
  └─ receive up to 10 (10s long poll, aborted on shutdown)
  └─ each message: handleProviderMessage (checks + record in one transaction) → delete only the handled ones
  └─ every 5 minutes: queue backlog and dead-letter counts
  └─ save the result only if events_poll_after still equals this lease
       ok → poll again now · error → back off 30s … 15m · draining after a switch to push and empty → stop
```

At most 20 connections are polled at once per worker. See [provider-events.md](provider-events.md).

## Shutdown and scaling

`close-with-grace` handles SIGTERM/SIGINT: stop claiming, wait for in-flight sends and webhook
requests (up to 25s, below both leases), close the database. Run more processes to scale; `SKIP LOCKED` keeps them from
taking the same email. A Postgres queue is comfortable well below about 100 concurrent senders;
beyond that, consider LISTEN/NOTIFY wake-ups, partitioning or a broker.

## Tests

`pnpm --filter @atlair-mail/worker test` uses a real Postgres and the fake provider from
`@atlair-mail/providers/testing`. Because the claim is global, `pnpm test` runs packages one at a
time (`turbo run test --concurrency=1`).
