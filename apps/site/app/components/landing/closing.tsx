import { closing } from '~/content'

import { Art } from './art'
import { Container, PrimaryCta } from './shared'

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="pb-24 lg:pb-32">
      <Container>
        <div data-reveal className="relative overflow-hidden rounded-3xl bg-[#68b8f8] dark:bg-[#0b1a3a]">
          <Art
            name="cta-postbox"
            night="cta-postbox-night"
            alt="Atlair’s cloud mascot posting a letter into a garden postbox"
            sizes="(min-width: 1560px) 1460px, 100vw"
            className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1c5d9c]/55 via-[#1c5d9c]/10 to-transparent dark:from-[#081848]/70" />
          <div className="relative max-w-xl px-7 py-24 text-white sm:px-14 sm:py-32 lg:py-44">
            <h2 id="closing-title" className="font-serif text-5xl leading-[1.02] text-balance sm:text-7xl">
              {closing.title}
            </h2>
            <p className="mt-5 text-lg text-white/90">{closing.dek}</p>
            <PrimaryCta tone="paper" className="mt-9">
              Start sending
            </PrimaryCta>
          </div>
        </div>
      </Container>
    </section>
  )
}
