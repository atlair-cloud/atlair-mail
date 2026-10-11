# Worker

`apps/worker` sends queued emails, delivers customer webhooks and reads provider events in pull mode. It is plain Node with
one small HTTP server for `GET /health`, and shares `packages/db`, `packages/core` and `packages/providers` with the API.
All three run on the same loop (`src/poll-loop.ts`): claim up to the free concurrency, process outside any transaction,
and when nothing is due, sleep until the next item is due or a notification arrives (see [Waking up](#waking-up)).

```bash
cp apps/worker/.env.example apps/worker/.env   # same DATABASE_URL and CREDENTIALS_ENCRYPTION_KEYS as the API
pnpm --filter @atlair-mail/worker dev
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | local compose database | Same database as the API |
| `DATABASE_LISTEN_URL` | `DATABASE_URL` | Direct (unpooled) URL for `LISTEN`. Set it when `DATABASE_URL` goes through PgBouncer in transaction mode, such as Neon's or PlanetScale's pooled URL, where `LISTEN` doesn't work |
| `CREDENTIALS_ENCRYPTION_KEYS` | required | Same keys as the API, to decrypt provider credentials |
| `LOG_LEVEL` | `info` | pino level |
| `WORKER_CONCURRENCY` | `10` | Emails sent at the same time by one process (1–100) |
| `EVENT_POLL_INTERVAL_SECONDS` | `600` | In pull mode, how long to wait after reading an empty queue (0–86400). After events it reads again right away. `0` reads continuously |
| `PORT` | `8081` | Port for `GET /health`. The Dockerfile sets `8080`, and Cloud Run sets its own |

Everything else is a constant in `src/settings.ts`: idle waits between 1s and 10m, 120s lease, lease sweep 1s after the earliest lease ends,
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
         runs 1s after the earliest lease ends, and at least every 10m
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
  └─ every 5 minutes at most: queue backlog and dead-letter counts
  └─ save the result only if events_poll_after still equals this lease
       events received → poll again now · empty → wait EVENT_POLL_INTERVAL_SECONDS (10m)
       error → back off 30s … 15m · shutdown → due again now · draining after a switch to push and empty → stop
```

At most 20 connections are polled at once per worker. See [provider-events.md](provider-events.md).

## Waking up

The worker doesn't poll on a fixed interval. An idle system runs about one query per loop every 10 minutes, so a serverless database (Neon suspends after 5 idle minutes) can sleep between checks.

```
API inserts a queued email ─┐
worker queues a retry ──────┼─ trigger (migration 0021) → pg_notify('atlair_work', 'email')
                            │                                   │
                            │       worker LISTEN connection ◄──┘ (DATABASE_LISTEN_URL)
                            │                 └─ wake the email loop → claim now
loop finds nothing due ─────┴─ SELECT min(send_at) - now() … status='queued' (partial index)
                                  └─ sleep that long: at least 1s if overdue, at most 10m
```

| Trigger | Fires on | Payload |
| --- | --- | --- |
| `emails_notify_work` | insert, or update of `status`/`send_at`, when the row is `queued` | `email` |
| `webhook_deliveries_notify_work` | insert | `webhook` |
| `provider_connections_notify_work` | `events_poll_after` going from null to a time (pull mode turned on) | `events` |

- **Claims never notify.** A claim moves an email to `sending`, which the trigger ignores, so the worker never wakes itself.
  Postgres also merges identical notifications in one transaction, so a batch insert sends one.
- **Finishing a job wakes its loop.** That's how webhook retries and the next event poll get picked up: the worker
  that wrote them claims again, then sleeps until the next due time.
- **Notifications are a shortcut, not the source of truth.** If the listener is down, the loops still claim at least
  every 10 minutes and at each item's due time. After each (re)connect, `onListen` wakes every loop, so work that
  arrived while disconnected is claimed straight away. A failed first connection is retried every 30s.
- **Scheduled emails** wake on time: the insert notifies, and the loop sleeps until `send_at`.

## Shutdown and scaling

`close-with-grace` handles SIGTERM/SIGINT: stop claiming, wait for in-flight sends and webhook
requests (up to 25s, below both leases), close the database. Run more processes to scale; `SKIP LOCKED` keeps them from
taking the same email. A Postgres queue is comfortable well below about 100 concurrent senders;
beyond that, consider partitioning or a broker.

## Tests

`pnpm --filter @atlair-mail/worker test` uses a real Postgres and the fake provider from
`@atlair-mail/providers/testing`. Because the claim is global, `pnpm test` runs packages one at a
time (`turbo run test --concurrency=1`).
