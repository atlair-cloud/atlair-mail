import { closing } from '~/content'

import { Art } from './art'
import { Container, GitHubCta, PrimaryCta } from './shared'

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="pb-16 sm:pb-24 lg:pb-32">
      <Container>
        <div data-reveal className="relative flex flex-col overflow-hidden rounded-lg bg-[#1f6fae] sm:block sm:bg-[#68b8f8] dark:bg-[#0b1a3a]">
          <Art
            name="cta-postbox"
            night="cta-postbox-night"
            alt="Atlair’s cloud mascot posting a letter into a garden postbox"
            sizes="(min-width: 1560px) 1460px, 100vw"
            className="aspect-[4/3] w-full object-cover object-[72%_center] sm:absolute sm:inset-0 sm:aspect-auto sm:h-full sm:object-[70%_center]"
          />
          <div className="absolute inset-0 hidden sm:block sm:bg-gradient-to-r sm:from-[#1c5d9c]/55 sm:via-[#1c5d9c]/10 dark:from-[#081848]/80 sm:dark:from-[#081848]/70" />
          <div className="relative order-first max-w-3xl px-6 pt-10 pb-10 text-white sm:px-14 sm:py-32 lg:py-44">
            <h2 id="closing-title" className="text-[2.75rem] leading-[1] font-semibold tracking-[-0.045em] sm:text-7xl">
              {closing.title[0]}
              <br />
              {closing.title[1]}
            </h2>
            <p className="mt-5 text-lg text-white/90">{closing.dek}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryCta tone="paper" className="justify-center">
                Start sending
              </PrimaryCta>
              <GitHubCta tone="night" className="justify-center border-white/25 bg-white/10 backdrop-blur hover:border-white/50" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
