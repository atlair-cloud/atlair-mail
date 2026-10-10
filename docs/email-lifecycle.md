# Email lifecycle

An email's `status` summarizes every recipient. Per-recipient results live in `email_events` and
are returned by `GET /service/web/emails/:id/events`. The rules live in `packages/core/src/email-status.ts`.

## Worker statuses

The worker moves an email through `canTransition(from, to)`:

| From | To |
| --- | --- |
| `queued` | `sending`, `canceled`, `failed` |
| `sending` | `sent`, `queued` (retry), `failed` |

Every worker write is guarded with `WHERE status = '<from>'` (see [worker.md](worker.md)).

## Statuses from provider events

Once the provider has the email, its status is **computed from all of the email's events**, not
moved step by step. Events can settle an email that is `sending`, `sent`, `failed`, `delivered`,
`bounced` or `complained` (`canSettleFromEvents`); never `queued` or `canceled`.

**1. Each recipient gets the strongest outcome among its events** (`recipientOutcomes`):

| Rank | Recipient's events include | Outcome |
| --- | --- | --- |
| 5 | `complained` (feedback type other than `not-spam`) | `complained` |
| 4 | `bounced`, permanent or undetermined | `bounced` |
| 3 | `delivered` | `delivered` |
| 2 | `bounced`, transient | `bounced` |
| 1 | `sent` | `sent` |

A delivery outranks a transient bounce. SES reports out-of-office replies as transient bounces
alongside the delivery, so that recipient stays `delivered`. A transient bounce with no delivery
means SES stopped retrying, so the recipient is `bounced`.

**2. The email gets the most severe recipient outcome** (`statusFromEvents`):
`complained` > `bounced` > `delivered` > `sent`. A `rejected` event makes it `failed` with
`lastError` `ATL_PROVIDER_REJECTED: Rejected`. `delivery_delayed`, `opened`, `clicked` and
`not-spam` reports are stored but never change the status.

One recipient bouncing while another is delivered leaves the email `bounced`; the events show who
received it.

### Rules

- **Order does not matter.** The provider and the transport (SNS) promise neither ordering nor
  single delivery. The status is a function of the set of events, so every arrival order ends in
  the same status. A property test (`fast-check`) checks this, plus repeats, for random event sets.
  The status can pass through a different value on the way (an out-of-office reply first reads
  `bounced`, then `delivered` once the delivery arrives).
- **Repeats do nothing.** Each event gets a key: SHA-256 of the provider message id, type, time and
  sorted recipients (`providerEventKey`). `email_events` is unique on `(email_id, provider_event_id)`
  and inserts with `ON CONFLICT DO NOTHING`. A content key catches a provider republishing the same
  event under a new transport message id.
- **Provider evidence settles uncertainty.** If the worker died after the provider accepted the
  message, the sweeper marks the email `failed (ATL_WORKER_LEASE_EXPIRED)`. Later events prove the
  send happened, so the email takes the computed status and `lastError` is cleared. A send the
  provider refused never produces events, so this cannot resurrect a real failure.
- **Worker failures are events too.** Whenever the worker sets `failed`, the same transaction adds a
  `failed` event (key `atlair:failed`, `error` holds the code) and queues `email.failed` webhooks. It
  is not an outcome event, so it never changes the computed status. See [webhooks.md](webhooks.md).

## Recording one event

`services.emailEvents.record(organizationId, event)` runs one transaction:

1. Find and **lock** the email (`SELECT … FOR UPDATE`) **inside the organization** by provider
   message id. Only if none matches, fall back to the `atlair_email_id` tag, and only for an email
   with no provider message id yet, so a tag can never redirect another email's events. The lock
   makes concurrent events for one email take turns, so each recomputation sees every earlier one.
2. Insert the event; a conflict means a repeat → `duplicate`.
3. Suppress the addresses the event calls for (see [suppressions.md](suppressions.md)), in address
   order so two transactions never wait on each other in opposite orders.
4. Recompute the status from the stored `sent`, `delivered`, `bounced`, `complained` and `rejected`
   events and update the email if it changed. The provider message id and sent time are filled
   only when empty.

The outcome is `applied`, `recorded`, `duplicate` or `not_found`, plus the number of addresses
newly suppressed.

Stored details are normalized and bounded (`boundEventDetails`): at most 50 recipients, control
characters removed, diagnostic and SMTP text capped at 1000 characters. Raw provider payloads,
subjects and headers are not stored. Logs carry the email id, type, outcome and counts only.
