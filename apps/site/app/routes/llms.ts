import { faq, GITHUB_URL, PRODUCT } from '~/content'
import { absoluteUrl } from '~/lib/seo'
import { alternatives } from '~/seo/alternatives'
import { useCases } from '~/seo/use-cases'

export function loader() {
  const body = `# ${PRODUCT}

> ${PRODUCT} is an open-source (AGPL-3.0) transactional email API and panel that sends through your own Amazon SES account. It runs on Postgres with an API and a worker process, and you can host it yourself. Source: ${GITHUB_URL}

## What it does today

- Send API: one HTTP request per email, with idempotency keys and scheduling up to 30 days ahead.
- Sends through the organization's own Amazon SES account. AWS credentials are encrypted and never returned.
- Domains: DKIM, SPF, custom MAIL FROM and DMARC records, with verification.
- Templates: a visual editor with variables, phone preview, versions and rollback.
- Webhooks: 9 event types signed to the Standard Webhooks spec, retried 8 times over about 27 hours.
- Automatic suppression of hard bounces and complaints, with checks again right before sending.
- A panel with an overview, email logs, a playground, organizations, roles and an audit log.

## Not built yet

- Attachments, batch sending, a Node SDK, open and click tracking, contacts and broadcasts.

## Comparisons

${alternatives.map((a) => `- [${PRODUCT} vs ${a.slug === 'amazon-ses' ? 'Amazon SES' : a.name}](${absoluteUrl(`/alternatives/${a.slug}`)}): ${a.summary}`).join('\n')}

## Use cases

${useCases.map((u) => `- [${u.name}](${absoluteUrl(`/use-cases/${u.slug}`)}): ${u.dek}`).join('\n')}

## Questions people ask

${faq.items.map((item) => `### ${item.q}\n\n${item.a}`).join('\n\n')}
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
