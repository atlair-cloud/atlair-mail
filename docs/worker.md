# Worker

`apps/worker` sends queued emails. It is plain Node (no HTTP server) and shares `packages/db`,
`packages/core` and `packages/providers` with the API.

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
6 attempts, backoff 30s → 2m → 10m → 30m → 1h with ±20% jitter, 25s shutdown grace.

## Lifecycle of one email

```
claim: UPDATE emails SET status='sending', locked_until=now()+120s, attempt_count+1
       WHERE id IN (SELECT id … status='queued' AND send_at<=now() ORDER BY send_at FOR UPDATE SKIP LOCKED)
  └─ pre-send checks (src/pre-send-checks.ts), first failure wins → failed
       provider connected → From domain still verified → no recipient suppressed
  └─ provider.send (withRetry inside, about 5s at most)
       ok                       → sent (provider_message_id, sent_at)
       ATL_PROVIDER_REJECTED    → failed
       THROTTLED / UNAVAILABLE  → queued again with backoff; failed after attempt 6
       ATL_PROVIDER_TIMEOUT     → failed (outcome unknown, never resent)
sweeper: status='sending' AND locked_until < now() → failed (ATL_WORKER_LEASE_EXPIRED)
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

## Shutdown and scaling

`close-with-grace` handles SIGTERM/SIGINT: stop claiming, wait for in-flight sends (up to 25s, below
the 120s lease), close the database. Run more processes to scale; `SKIP LOCKED` keeps them from
taking the same email. A Postgres queue is comfortable well below about 100 concurrent senders;
beyond that, consider LISTEN/NOTIFY wake-ups, partitioning or a broker.

## Tests

`pnpm --filter @atlair-mail/worker test` uses a real Postgres and the fake provider from
`@atlair-mail/providers/testing`. Because the claim is global, `pnpm test` runs packages one at a
time (`turbo run test --concurrency=1`).
