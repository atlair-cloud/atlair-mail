import { ArrowRight } from 'lucide-react'
import { siGithub, siX } from 'simple-icons'

import { APP_URL, DOCS_URL, GITHUB_URL, HELP_EMAIL, nav, social } from '~/content'
import { alternatives } from '~/seo/alternatives'
import { useCases } from '~/seo/use-cases'

import { Art } from './art'
import { Brand } from './site-header'
import { BrandIcon, Container } from './shared'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}

const icons = {
  X: <BrandIcon icon={siX} color="currentColor" className="size-4" />,
  LinkedIn: <LinkedInIcon className="size-4" />,
  GitHub: <BrandIcon icon={siGithub} color="currentColor" className="size-4" />,
}

const label = (slug: string, name: string) => (slug === 'amazon-ses' ? 'Amazon SES' : name)

const columns = [
  {
    title: 'Product',
    links: nav.map((n) => ({ label: n.label === 'Product' ? 'Features' : n.label, href: n.href })),
  },
  {
    title: 'Developers',
    links: [
      { label: 'API docs', href: DOCS_URL },
      { label: 'Source code', href: GITHUB_URL },
      { label: 'Open the panel', href: APP_URL },
      { label: 'llms.txt', href: '/llms.txt' },
    ],
  },
  {
    title: 'Compare',
    links: alternatives.slice(0, 5).map((a) => ({ label: label(a.slug, a.name), href: `/alternatives/${a.slug}` })),
    more: { label: 'All comparisons', href: '/alternatives' },
  },
  {
    title: 'Use cases',
    links: useCases.slice(0, 5).map((u) => ({ label: u.name, href: `/use-cases/${u.slug}` })),
    more: { label: 'All use cases', href: '/use-cases' },
  },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden">
      <Container className="grid gap-12 border-t border-line pt-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <Brand />
          <p className="mt-3 max-w-xs text-ink-soft">Every email, accounted for.</p>
          <ul className="mt-6 flex gap-2" aria-label="Social media">
            {social.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  rel="me noopener"
                  target="_blank"
                  aria-label={`Atlair on ${s.label}`}
                  className="grid size-10 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
                >
                  {icons[s.label]}
                </a>
              </li>
            ))}
          </ul>
          <a href={`mailto:${HELP_EMAIL}`} className="mt-5 inline-block text-[15px] text-ink-soft hover:text-ink">
            {HELP_EMAIL}
          </a>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2.5 text-[15px]">
              <p className="text-sm text-ink-faint">{col.title}</p>
              {col.links.map((l) => (
                <a key={l.href} href={l.href} className="text-ink-soft hover:text-ink">
                  {l.label}
                </a>
              ))}
              {col.more && (
                <a href={col.more.href} className="inline-flex items-center gap-1 font-medium hover:text-sky-deep">
                  {col.more.label}
                  <ArrowRight aria-hidden className="size-3.5" />
                </a>
              )}
            </nav>
          ))}
        </div>
      </Container>
      <Container className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-ink-faint">
        <p>© 2026 Atlair · Open source under AGPL-3.0</p>
        <div className="flex gap-6">
          <a href="https://atlair.cloud/privacy" className="hover:text-ink">
            Privacy
          </a>
          <a href="https://atlair.cloud/terms" className="hover:text-ink">
            Terms
          </a>
          <a href="/sitemap.xml" className="hover:text-ink">
            Sitemap
          </a>
        </div>
      </Container>
      <div className="relative mt-6">
        <div className="aspect-[2560/896]">
          <Art name="footer-land" night="footer-land-night" className="block w-full [mask-image:linear-gradient(to_bottom,transparent,black_30%)]" />
        </div>
        <p
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[4%] text-center font-serif text-[26vw] leading-none tracking-[-0.03em] text-[#5eb7e6]/35 italic select-none dark:text-[#5eb7e6]/25"
        >
          Post
        </p>
      </div>
    </footer>
  )
}
