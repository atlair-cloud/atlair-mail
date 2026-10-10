import { ArrowRight } from 'lucide-react'

import { PRODUCT } from '~/content'
import { alternatives } from '~/seo/alternatives'

import { Closing } from './closing'
import { Container, delay } from './shared'

export function AlternativesHub() {
  return (
    <>
      <section>
        <Container className="pt-16 pb-14 lg:pt-24">
          <h1 data-reveal className="max-w-4xl font-serif text-[3.25rem] leading-[0.98] text-balance sm:text-7xl">
            {PRODUCT}, compared.
          </h1>
          <p data-reveal style={delay(100)} className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
            How it stacks up against the email platforms you already know, and when each one fits better.
          </p>
        </Container>
      </section>
      <section aria-label="Comparisons" className="pb-24">
        <Container>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map((a, i) => (
              <li key={a.slug} data-reveal style={delay((i % 3) * 60)} className="bg-card">
                <a href={`/alternatives/${a.slug}`} className="group flex h-full flex-col p-6 hover:bg-surface">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xl font-semibold tracking-tight">
                      {PRODUCT} vs {a.slug === 'amazon-ses' ? 'Amazon SES' : a.name}
                    </span>
                    <ArrowRight aria-hidden className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-2 text-[15px] text-ink-soft">{a.summary}</span>
                  {a.openSource && <span className="mt-4 self-start rounded-sm bg-live-soft px-1.5 py-0.5 font-mono text-[11px] text-live-deep">Also open source</span>}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <Closing />
    </>
  )
}
