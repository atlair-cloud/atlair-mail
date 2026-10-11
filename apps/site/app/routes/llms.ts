import { faq, GITHUB_URL, HELP_EMAIL, PRODUCT } from '~/content'
import { absoluteUrl, markdownPath } from '~/lib/seo'
import { alternatives } from '~/seo/alternatives'
import { useCases } from '~/seo/use-cases'

export function loader() {
  const body = `# ${PRODUCT}

> ${PRODUCT} is an open-source (AGPL-3.0) transactional email API and panel that sends through your own Amazon SES account. It runs on Postgres with an API and a worker process, and you can host it yourself. Source: ${GITHUB_URL}

${PRODUCT} is made by Atlair (A-T-L-A-I-R), sometimes searched as "Atlair email". It is not Altair Engineering and has no connection to Siemens.

## Read more

- [Home page as Markdown](${absoluteUrl(markdownPath('/'))})
- [All comparisons](${absoluteUrl(markdownPath('/alternatives'))})
- [All use cases](${absoluteUrl(markdownPath('/use-cases'))})

Every page has a Markdown copy: add \`.md\` to its path, or \`/index.md\` for the home page.

## Support

- Email: ${HELP_EMAIL}
- GitHub issues: ${GITHUB_URL}/issues

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

${alternatives.map((a) => `- [${PRODUCT} vs ${a.slug === 'amazon-ses' ? 'Amazon SES' : a.name}](${absoluteUrl(markdownPath(`/alternatives/${a.slug}`))}): ${a.summary}`).join('\n')}

## Use cases

${useCases.map((u) => `- [${u.name}](${absoluteUrl(markdownPath(`/use-cases/${u.slug}`))}): ${u.dek}`).join('\n')}

## Questions people ask

${faq.items.map((item) => `### ${item.q}\n\n${item.a}`).join('\n\n')}
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
