import { faq, GITHUB_URL, PRODUCT, SITE_URL, social } from '~/content'
import { alternatives, checkedOn, findAlternative, type Alternative } from '~/seo/alternatives'
import { findUseCase, useCases, type UseCase } from '~/seo/use-cases'

export const modified = checkedOn

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}

type Page = { path: string; title: string; description: string; image: string }

export const home: Page = {
  path: '/',
  title: `${PRODUCT}: Open-Source Email API and Resend Alternative`,
  description:
    'Open-source transactional email API and panel. Send through your own Amazon SES, edit templates, get signed webhooks. A self-hostable Resend and SendGrid alternative.',
  image: '/og/home.jpg',
}

export const hub: Page = {
  path: '/alternatives',
  title: `Open-Source Email API Alternatives Compared | ${PRODUCT}`,
  description: `How ${PRODUCT} compares with Resend, SendGrid, Mailgun, Postmark, Amazon SES, Brevo, Loops, Plunk and useSend. Honest notes on when each one fits.`,
  image: '/og/alternatives.jpg',
}

export function alternativePage(a: Alternative): Page {
  const label = a.slug === 'amazon-ses' ? 'Amazon SES' : a.name
  return {
    path: `/alternatives/${a.slug}`,
    title: a.openSource ? `${PRODUCT} vs ${label}: Open-Source Email APIs` : `Open-Source ${label} Alternative | ${PRODUCT}`,
    description: `Compare ${PRODUCT} and ${label}. ${PRODUCT} is open source (AGPL-3.0), self-hostable, and sends through your own Amazon SES. See when each one fits.`,
    image: `/og/${a.slug}.jpg`,
  }
}

export const useCaseHub: Page = {
  path: '/use-cases',
  title: `Transactional Email Use Cases | ${PRODUCT}`,
  description: `Password resets, magic links, verification codes, receipts, welcome and scheduled emails with ${PRODUCT}, the open-source email API on your own Amazon SES.`,
  image: '/og/use-cases.jpg',
}

export function useCasePage(u: UseCase): Page {
  return {
    path: `/use-cases/${u.slug}`,
    title: `${u.name} API, Open Source | ${PRODUCT}`,
    description: `${u.dek} Send ${u.name.toLowerCase()} with ${PRODUCT}, the open-source email API on your own Amazon SES. One request, signed webhooks, AGPL-3.0.`,
    image: `/og/${u.slug}.jpg`,
  }
}

export const allPages: Page[] = [home, hub, ...alternatives.map(alternativePage), useCaseHub, ...useCases.map(useCasePage)]

function base(page: Page) {
  const url = absoluteUrl(page.path)
  const image = absoluteUrl(page.image)
  return [
    { title: page.title },
    { name: 'description', content: page.description },
    { tagName: 'link', rel: 'canonical', href: url },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: PRODUCT },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: page.title },
    { name: 'twitter:description', content: page.description },
    { name: 'twitter:image', content: image },
  ]
}

function faqSchema(items: readonly { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  }
}

function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  }
}

const software = {
  '@type': 'SoftwareApplication',
  name: PRODUCT,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Docker',
  description: home.description,
  url: SITE_URL,
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  codeRepository: GITHUB_URL,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free to host yourself under AGPL-3.0.' },
  publisher: { '@type': 'Organization', name: 'Atlair', url: 'https://atlair.cloud', sameAs: social.map((s) => s.href) },
}

function graph(...nodes: object[]) {
  return { 'script:ld+json': { '@context': 'https://schema.org', '@graph': nodes } }
}

export function homeMeta() {
  return [...base(home), graph(software, faqSchema(faq.items))]
}

export function hubMeta() {
  return [...base(hub), graph(breadcrumbs([{ name: PRODUCT, path: '/' }, { name: 'Alternatives', path: '/alternatives' }]))]
}

export function alternativeFaq(a: Alternative) {
  const label = a.slug === 'amazon-ses' ? 'Amazon SES' : a.name
  const switching =
    a.slug === 'amazon-ses'
      ? []
      : [
          {
            q: `Is ${PRODUCT} a drop-in replacement for ${label}?`,
            a: 'Not exactly. Sending is one HTTP request in both, but the endpoint and fields differ, so you’ll change a few lines of code. Your domain stays; you add DKIM records for Amazon SES.',
          },
        ]
  return [
    ...(a.extraFaq ? [a.extraFaq] : []),
    ...switching,
    {
      q: `Is ${PRODUCT} free?`,
      a: 'Hosting it yourself is free under AGPL-3.0, and you pay AWS for sending. Pricing for a hosted version isn’t decided yet.',
    },
  ]
}

export function alternativeMeta(slug: string | undefined) {
  const a = findAlternative(slug)
  if (!a) return [{ title: `Not found | ${PRODUCT}` }, { name: 'robots', content: 'noindex' }]
  const page = alternativePage(a)
  return [
    ...base(page),
    graph(
      breadcrumbs([
        { name: PRODUCT, path: '/' },
        { name: 'Alternatives', path: '/alternatives' },
        { name: a.name, path: page.path },
      ]),
      faqSchema(alternativeFaq(a)),
    ),
  ]
}

export function useCaseHubMeta() {
  return [...base(useCaseHub), graph(breadcrumbs([{ name: PRODUCT, path: '/' }, { name: 'Use cases', path: '/use-cases' }]))]
}

export function useCaseMeta(slug: string | undefined) {
  const u = findUseCase(slug)
  if (!u) return [{ title: `Not found | ${PRODUCT}` }, { name: 'robots', content: 'noindex' }]
  const page = useCasePage(u)
  return [
    ...base(page),
    graph(
      breadcrumbs([
        { name: PRODUCT, path: '/' },
        { name: 'Use cases', path: '/use-cases' },
        { name: u.name, path: page.path },
      ]),
      faqSchema(u.faq),
    ),
  ]
}
