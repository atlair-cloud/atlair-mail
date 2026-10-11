import { cases, faq, features, flow, GITHUB_URL, HELP_EMAIL, hero, openSource, PRODUCT } from '~/content'
import { absoluteUrl, alternativeFaq } from '~/lib/seo'
import { alternatives, checkedOn, choosePost, findAlternative, type Alternative } from '~/seo/alternatives'
import { curlFor, findUseCase, useCases, type UseCase } from '~/seo/use-cases'

const label = (a: Alternative) => (a.slug === 'amazon-ses' ? 'Amazon SES' : a.name)

const qa = (items: readonly { q: string; a: string }[]) => items.map((item) => `### ${item.q}\n\n${item.a}`).join('\n\n')

const links = (items: { name: string; path: string; note: string }[]) =>
  items.map((item) => `- [${item.name}](${absoluteUrl(item.path)}): ${item.note}`).join('\n')

const footer = `---

Support: ${HELP_EMAIL} · Source: ${GITHUB_URL} · Summary for AI: ${absoluteUrl('/llms.txt')}
`

function home() {
  return `# ${hero.title}

> ${hero.dek}

${PRODUCT} is Atlair’s open-source (AGPL-3.0) email API. It is not Altair Engineering and has no connection to Siemens.

## ${flow.title.join(' ')}

Your app sends one request to ${PRODUCT}. A worker sends the email from your own cloud account, and every event (sent, delivered, bounced, complained) comes back to you as a signed webhook.

## ${features.title.join(' ')}

${[features.templates, features.webhooks, features.domains, features.once].map((f) => `- **${f.title}** ${f.body}`).join('\n')}

## ${cases.title.join(' ')}

${links(useCases.map((u) => ({ name: u.name, path: `/use-cases/${u.slug}`, note: u.dek })))}

## ${openSource.title.join(' ')}

\`\`\`sh
${openSource.command}
\`\`\`

## Comparisons

${links(alternatives.map((a) => ({ name: `${PRODUCT} vs ${label(a)}`, path: `/alternatives/${a.slug}`, note: a.summary })))}

## Questions

${qa(faq.items)}

${footer}`
}

function alternativesHub() {
  return `# ${PRODUCT}, compared.

> How it stacks up against the email platforms you already know, and when each one fits better.

${links(alternatives.map((a) => ({ name: `${PRODUCT} vs ${label(a)}`, path: `/alternatives/${a.slug}`, note: a.summary })))}

${footer}`
}

function alternative(a: Alternative) {
  const name = label(a)
  const yes = (v: boolean) => (v ? 'Yes' : 'No')
  return `# ${a.openSource ? `${PRODUCT} vs ${name}.` : `An open-source alternative to ${name}.`}

> ${PRODUCT} sends through your own Amazon SES account, and you can host it yourself.

${name}: ${a.summary}

| | ${PRODUCT} | ${name} |
| --- | --- | --- |
| Open source | Yes | ${yes(a.openSource)} |
| Host it yourself | Yes | ${yes(a.selfHost)} |
| Sends from | Your AWS account | ${a.sendsFrom} |
| Pricing | AWS’s price per email | [${a.pricing}](${a.pricingUrl}) |

From each product’s public website, checked ${checkedOn}.

## Choose ${PRODUCT} if

${choosePost.map((c) => `- ${c}`).join('\n')}

## Choose ${name} if

${a.chooseThem.map((c) => `- ${c}`).join('\n')}

## Questions

${qa(alternativeFaq(a))}

${footer}`
}

function useCasesHub() {
  return `# The emails your product sends.

> One request each, delivered from your own domain.

${links(useCases.map((u) => ({ name: u.name, path: `/use-cases/${u.slug}`, note: u.dek })))}

${footer}`
}

function useCase(u: UseCase) {
  return `# ${u.title}

> ${u.dek}

${u.points.map((p) => `- **${p.title}** ${p.body}`).join('\n')}

## Send it

\`\`\`sh
${curlFor(u)}
\`\`\`

The API answers \`202 Accepted\` with an id, then the email moves from queued to sent to delivered.

## Questions

${qa(u.faq)}

${footer}`
}

export function markdownFor(path: string) {
  const [section, slug] = path.replace(/^\/+|\/+$/g, '').split('/')
  if (!section || section === 'index') return home()
  if (section === 'alternatives') {
    if (!slug) return alternativesHub()
    const a = findAlternative(slug)
    return a ? alternative(a) : null
  }
  if (section === 'use-cases') {
    if (!slug) return useCasesHub()
    const u = findUseCase(slug)
    return u ? useCase(u) : null
  }
  return null
}
