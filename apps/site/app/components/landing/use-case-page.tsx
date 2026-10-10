import { ArrowRight, Copy, Plus } from 'lucide-react'

import { PRODUCT } from '~/content'
import { curlFor, useCases, type UseCase } from '~/seo/use-cases'

import { Postcard } from './postal'
import { Closing } from './closing'
import { Container, delay, GitHubCta, PrimaryCta, Title } from './shared'

export function UseCasePage({ useCase }: { useCase: UseCase }) {
  const others = useCases.filter((u) => u.slug !== useCase.slug)

  return (
    <>
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-12 pt-16 pb-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pt-24">
          <div>
            <nav data-reveal aria-label="Breadcrumb" className="font-mono text-xs text-ink-faint">
              <a href="/" className="hover:text-ink">
                {PRODUCT}
              </a>{' '}
              /{' '}
              <a href="/use-cases" className="hover:text-ink">
                Use cases
              </a>{' '}
              / {useCase.name}
            </nav>
            <h1 data-reveal style={delay(80)} className="mt-6 font-serif text-[3.25rem] leading-[0.98] text-balance sm:text-7xl">
              {useCase.title}
            </h1>
            <p data-reveal style={delay(160)} className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
              {useCase.dek}
            </p>
            <div data-reveal style={delay(240)} className="mt-9 flex flex-wrap gap-3">
              <PrimaryCta>Start sending</PrimaryCta>
              <GitHubCta />
            </div>
          </div>
          <div data-reveal style={delay(200)}>
            <Postcard art={useCase.art} sizes="(min-width: 1024px) 40vw, 100vw" tilt={1.4} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="how-title" className="pb-24">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <h2 id="how-title" className="sr-only">
              How it works
            </h2>
            <ul className="space-y-8">
              {useCase.points.map((p, i) => (
                <li key={p.title} data-reveal style={delay(i * 80)}>
                  <p className="font-serif text-3xl">{p.title}</p>
                  <p className="mt-1.5 text-lg text-ink-soft">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal style={delay(120)} className="min-w-0 self-start overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="font-mono text-xs text-ink-faint">POST /service/web/emails</span>
              <Copy aria-hidden className="size-3.5 text-ink-faint" />
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed text-ink-soft">{curlFor(useCase)}</pre>
            <div className="flex items-center gap-2 border-t border-line bg-surface/60 px-5 py-3 font-mono text-xs">
              <span className="rounded-sm bg-live-soft px-1.5 py-0.5 text-live-deep">202 Accepted</span>
              <span className="text-ink-faint">then queued → sent → delivered</span>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="uc-faq-title" className="pb-24">
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Title id="uc-faq-title">Questions, answered.</Title>
          <div className="faq border-t border-line">
            {useCase.faq.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium tracking-tight hover:text-sky-deep [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-ink-soft transition-transform duration-300 group-open:rotate-45">
                    <Plus aria-hidden className="size-3.5" />
                  </span>
                </summary>
                <p className="pr-12 pb-6 text-[15px] leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="more-uc-title" className="pb-24">
        <Container>
          <h2 id="more-uc-title" className="font-mono text-xs tracking-[0.14em] text-ink-faint uppercase">
            More use cases
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((u) => (
              <li key={u.slug}>
                <a href={`/use-cases/${u.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm hover:border-ink-faint">
                  {u.name}
                  <ArrowRight aria-hidden className="size-3.5 text-ink-faint" />
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
