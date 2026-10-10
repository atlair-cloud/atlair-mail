import { features } from '~/content'

import { Postcard } from './postal'
import { Container, delay } from './shared'

const tilts = [-1.6, 1.2, -0.8]
const stamps = ['1¢', '2¢', '3¢']
const tints = ['bg-sky-soft', 'bg-pink-soft', 'bg-live-soft']

export function Features() {
  return (
    <section id="product" aria-label="What it does" className="py-24 lg:py-36">
      <Container className="grid gap-12 md:grid-cols-3 md:gap-8 xl:gap-12">
        {features.map((f, i) => (
          <article key={f.title} data-reveal style={delay(i * 100)}>
            <Postcard art={f.art} sizes="(min-width: 768px) 33vw, 100vw" tilt={tilts[i]} stamp={stamps[i]} tint={tints[i]}>
              <h2 className="font-serif text-4xl leading-tight">{f.title}</h2>
              <p className="mt-2 text-lg text-ink-soft">{f.body}</p>
            </Postcard>
          </article>
        ))}
      </Container>
    </section>
  )
}
