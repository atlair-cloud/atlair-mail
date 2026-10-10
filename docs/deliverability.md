# Deliverability

What it takes for mail sent through atlair-mail to reach Gmail, Outlook and Yahoo inboxes.

## Checklist

| Item | How | Where |
| --- | --- | --- |
| Leave the SES sandbox | SES console → Account dashboard → Request production access | AWS, about a day |
| DKIM | Publish the three `DKIM` CNAMEs | `POST /service/web/domains` records |
| SPF alignment | Publish the `MAIL_FROM` MX and `SPF` TXT records on `bounce.<domain>` | records after the domain is verified |
| DMARC | Publish `_dmarc.<domain>` TXT `v=DMARC1; p=none;`, move to `quarantine` and `reject` once reports look clean | records |
| One-click unsubscribe (bulk mail) | Send `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers | `headers` in `POST /service/web/emails` |
| Low bounce and complaint rates | Register the events URL so bounce and complaint events arrive ([provider-events.md](provider-events.md)); hard bounces and complaints are then suppressed automatically ([suppressions.md](suppressions.md)) | `POST /service/web/provider/events` |
| Warm-up | Start with tens to hundreds of emails a day to engaged recipients and grow gradually | operations |

Gmail and Yahoo require SPF or DKIM aligned with the From domain plus a DMARC record for bulk senders,
and expect complaint rates below 0.3%. DKIM alone already passes DMARC; the return path adds SPF so both
align.

## Testing without hurting reputation

The SES mailbox simulator works in the sandbox and does not count toward bounce or complaint rates:
`success@simulator.amazonses.com`, `bounce@simulator.amazonses.com`,
`complaint@simulator.amazonses.com`, `suppressionlist@simulator.amazonses.com`.

In the sandbox, recipients must be verified identities (an address, or any address at a verified
domain). A send to anyone else fails with `ATL_PROVIDER_REJECTED: MessageRejected`.
