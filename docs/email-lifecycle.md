# Email lifecycle

An email's `status` summarizes every recipient. Per-recipient results live in `email_events` and
are returned by `GET /v1/emails/:id/events`.

## Statuses

The table lives in `packages/core/src/email-status.ts`; `canTransition(from, to)` is the only rule.

| From | To |
| --- | --- |
| `queued` | `sending`, `canceled`, `failed` |
| `sending` | `sent`, `queued`, `failed`, `delivered`, `bounced`, `complained` |
| `sent` | `delivered`, `bounced`, `complained`, `failed` |
| `delivered` | `bounced`, `complained` |
| `bounced` | `complained` |
| `failed` | `delivered`, `bounced`, `complained` |
| `complained`, `canceled` | none |

## Provider events

| Event | Status |
| --- | --- |
| `sent` | `sent` |
| `delivered` | `delivered` |
| `bounced` (permanent or undetermined) | `bounced` |
| `complained` | `complained` |
| `rejected` | `failed` (`ATL_PROVIDER_REJECTED: Rejected`) |
| `bounced` (transient), `delivery_delayed`, `opened`, `clicked` | recorded, no status change |

### Rules

- **Most severe outcome wins.** Provider statuses only move forward through
  `sent → delivered → bounced → complained`. One recipient bouncing while another is delivered
  leaves the email `bounced`; check the events for who received it.
- **Order does not matter.** The provider and the transport (SNS) promise neither ordering nor
  single delivery. Because every move goes forward, any arrival order ends in the same status.
  A property test (`fast-check`) checks this for random event sequences.
- **Repeats do nothing.** Each event gets a key: SHA-256 of the provider message id, type, time and
  sorted recipients (`providerEventKey`). `email_events` is unique on `(email_id, provider_event_id)`
  and inserts with `ON CONFLICT DO NOTHING`. A content key catches a provider republishing the same
  event under a new transport message id.
- **Provider evidence settles uncertainty.** If the worker died after the provider accepted the
  message, the sweeper marks the email `failed (ATL_WORKER_LEASE_EXPIRED)`. A later `delivered`,
  `bounced` or `complained` event proves the send happened, so the email moves to that status and
  `lastError` is cleared. A send the provider refused never produces events, so this cannot
  resurrect a real failure. The same applies to an event that arrives while the email is still
  `sending`.

## Recording one event

`services.emailEvents.record(organizationId, event)` runs one transaction:

1. Find the email **inside the organization** by provider message id. Only if none matches, fall
   back to the `atlair_email_id` tag, and only for an email with no provider message id yet, so a
   tag can never redirect another email's events.
2. Insert the event; a conflict means a repeat → `duplicate`.
3. Map the event to a status. No status → `recorded`.
4. `UPDATE emails … WHERE id = $1 AND status = ANY(<statuses allowed to move to the target>)`.
   Under READ COMMITTED a concurrent update makes this statement wait, then re-check its `WHERE`
   against the committed row, so it acts as a compare-and-set with no explicit lock. The provider
   message id and sent time are filled only when empty.

The outcome is `applied`, `recorded`, `duplicate` or `not_found`.

Stored details are normalized and bounded (`boundEventDetails`): at most 50 recipients, control
characters removed, diagnostic and SMTP text capped at 1000 characters. Raw provider payloads,
subjects and headers are not stored. Logs carry the email id, type and outcome only.
