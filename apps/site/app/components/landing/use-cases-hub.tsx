import { useCases } from '~/seo/use-cases'

import { Postcard } from './postal'
import { Closing } from './closing'
import { Container, delay } from './shared'

export function UseCasesHub() {
  return (
    <>
      <section>
        <Container className="pt-16 pb-14 lg:pt-24">
          <h1 data-reveal className="max-w-4xl font-serif text-[3.25rem] leading-[0.98] text-balance sm:text-7xl">
            The emails your product sends.
          </h1>
          <p data-reveal style={delay(100)} className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
            One request each, delivered from your own domain.
          </p>
        </Container>
      </section>
      <section aria-label="Use cases" className="pb-24">
        <Container>
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((u, i) => (
              <li key={u.slug} data-reveal style={delay((i % 3) * 80)}>
                <a href={`/use-cases/${u.slug}`} className="block">
                  <Postcard art={u.art} sizes="(min-width: 1024px) 33vw, 100vw" tilt={[-1.4, 1, -0.6][i % 3]} stamp={`${i + 1}¢`}>
                    <p className="font-serif text-3xl">{u.name}</p>
                    <p className="mt-1.5 text-ink-soft">{u.dek}</p>
                  </Postcard>
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
