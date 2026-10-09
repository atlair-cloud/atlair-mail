# Suppressions

Addresses an organization never sends to. Sending protects the sender's reputation: mailbox
providers penalize repeated mail to dead addresses and to people who reported spam.

## Where entries come from

| Source | Reason | When |
| --- | --- | --- |
| Permanent bounce | `hard_bounce` | The provider reports the address does not exist or refuses mail for good. |
| Complaint | `complaint` | The recipient marked an email as spam. Reports with feedback type `not-spam` are corrections and do not suppress. |
| You | `manual` | `POST /v1/suppressions`. |

Never suppressed: transient bounces (mailbox full, out-of-office replies, provider gave up for now)
and undetermined bounces. These still show in the email's events and status.

Automatic entries are written in the same transaction as the provider event that caused them, with
`sourceEmailId` pointing at that email. The first reason for an address is kept.

**Complaints can cover more than one person.** Many mailbox providers hide who complained. SES then
lists every recipient of that email at the complaining domain, and suppresses all of them in its
own account-level list as well; atlair-mail does the same. Remove an entry if you know a recipient
did not complain.

## Enforcement

- `POST /v1/emails` rejects any suppressed recipient in `to`, `cc` or `bcc` with
  `422 ATL_RECIPIENT_SUPPRESSED` and lists the addresses.
- The worker checks again just before sending, so an address suppressed after the email was queued
  fails it with `ATL_RECIPIENT_SUPPRESSED` instead of sending.

Matching is case-insensitive; addresses are stored lowercase.

## API

All routes need a `full_access` key and only see the caller's organization.

| Route | |
| --- | --- |
| `GET /v1/suppressions` | Oldest first. `limit` (1–100, default 50) and `after` (the last `id` of the previous page); the response has `hasMore`. `?address=` looks up one address. |
| `POST /v1/suppressions` `{ "address": "ada@example.com" }` | Adds a `manual` entry: `201`, or `200` with the existing entry. One plain address only: no display name, lists or control characters. |
| `DELETE /v1/suppressions/:id` | Removes the entry: `204`, or `404`. |

Remove an entry only after fixing the cause: the address is valid again, or the recipient asked to
receive your email. Sending again to an address that hard-bounced or complained harms delivery for
every other recipient.

## Security

| Concern | Control |
| --- | --- |
| Forged suppressions | Automatic entries only come from signed, topic-checked provider events ([provider-events.md](provider-events.md)). |
| Tenant isolation | Entries belong to the connection's organization; reads and deletes filter by it. |
| Over-suppression | No transient, undetermined, out-of-office or `not-spam` entries. |
| Lock ordering | The email row is locked first, then addresses are inserted in sorted order. |
| Personal data in logs | Only counts are logged, never addresses. |
