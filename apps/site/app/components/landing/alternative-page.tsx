import { Check, Minus, Plus } from 'lucide-react'

import { PRODUCT } from '~/content'
import { alternativeFaq } from '~/lib/seo'
import { alternatives, checkedOn, choosePost, type Alternative } from '~/seo/alternatives'

import { Postcard } from './postal'
import { Closing } from './closing'
import { Container, delay, GitHubCta, PrimaryCta, Title } from './shared'

function Yes({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1.5 text-live-deep">
      <Check aria-hidden className="size-4" strokeWidth={2.5} /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-ink-faint">
      <Minus aria-hidden className="size-4" /> No
    </span>
  )
}

export function AlternativePage({ alt }: { alt: Alternative }) {
  const label = alt.slug === 'amazon-ses' ? 'Amazon SES' : alt.name
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ['Open source', <Yes value />, <Yes value={alt.openSource} />],
    ['Host it yourself', <Yes value />, <Yes value={alt.selfHost} />],
    ['Sends from', 'Your AWS account', alt.sendsFrom],
    [
      'Pricing',
      'AWS’s price per email',
      <a href={alt.pricingUrl} className="underline decoration-line-strong underline-offset-4 hover:text-ink">
        {alt.pricing}
      </a>,
    ],
  ]
  const faq = alternativeFaq(alt)
  const others = alternatives.filter((a) => a.slug !== alt.slug)

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
              <a href="/alternatives" className="hover:text-ink">
                Alternatives
              </a>{' '}
              / {alt.name}
            </nav>
            <h1 data-reveal style={delay(80)} className="mt-6 font-serif text-[3.25rem] leading-[0.98] text-balance sm:text-7xl">
              {alt.openSource ? `${PRODUCT} vs ${label}.` : `An open-source alternative to ${label}.`}
            </h1>
            <p data-reveal style={delay(160)} className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
              {PRODUCT} sends through your own Amazon SES account, and you can host it yourself.
            </p>
            <div data-reveal style={delay(240)} className="mt-9 flex flex-wrap gap-3">
              <PrimaryCta>Start sending</PrimaryCta>
              <GitHubCta />
            </div>
          </div>
          <div data-reveal style={delay(200)}>
            <Postcard art="vignette-key" sizes="(min-width: 1024px) 40vw, 100vw" tilt={1.4} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="compare-title" className="pb-24">
        <Container>
          <h2 id="compare-title" className="sr-only">
            {PRODUCT} and {label} compared
          </h2>
          <div data-reveal className="overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full min-w-[36rem] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-1/4 px-6 py-4 font-normal text-ink-faint" />
                  <th className="px-6 py-4 font-semibold">{PRODUCT}</th>
                  <th className="px-6 py-4 font-semibold">{label}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(([k, ours, theirs]) => (
                  <tr key={k}>
                    <th scope="row" className="px-6 py-4 font-normal text-ink-soft">
                      {k}
                    </th>
                    <td className="px-6 py-4">{ours}</td>
                    <td className="px-6 py-4 text-ink-soft">{theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-faint">From each product’s public website, checked {checkedOn}.</p>

          <div className="mt-16 grid gap-10 md:grid-cols-2">
            {[
              { title: `Choose ${PRODUCT} if`, items: choosePost },
              { title: `Choose ${label} if`, items: alt.chooseThem },
            ].map((col, i) => (
              <div key={col.title} data-reveal style={delay(i * 100)}>
                <h2 className="font-serif text-4xl">{col.title}</h2>
                <ul className="mt-5 space-y-3">
                  {col.items.map((item) => (
                    <li key={item} className="flex gap-3 text-lg text-ink-soft">
                      <Check aria-hidden className="mt-1.5 size-4 shrink-0 text-live-deep" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="alt-faq-title" className="pb-24">
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Title id="alt-faq-title">Questions, answered.</Title>
          <div className="faq border-t border-line">
            {faq.map((item) => (
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

      <section aria-labelledby="more-title" className="pb-24">
        <Container>
          <h2 id="more-title" className="font-mono text-xs tracking-[0.14em] text-ink-faint uppercase">
            More comparisons
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((a) => (
              <li key={a.slug}>
                <a href={`/alternatives/${a.slug}`} className="inline-flex h-9 items-center rounded-full border border-line bg-card px-4 text-sm hover:border-ink-faint">
                  {a.slug === 'amazon-ses' ? 'Amazon SES' : a.name}
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
