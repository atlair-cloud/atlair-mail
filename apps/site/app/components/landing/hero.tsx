import { Check } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

import { hero } from '~/content'

import { Art } from './art'
import { OverviewMock } from './panel/overview'
import { Container, delay, GitHubCta, PrimaryCta } from './shared'

export function Hero() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: sceneRef, offset: ['start end', 'end start'] })
  const artY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%'])

  return (
    <section className="relative overflow-hidden">
      <Container className="relative z-10 flex flex-col items-center pt-20 text-center lg:pt-28">
        <p data-reveal className="rounded-sm border border-line bg-card/70 px-3 py-1 font-mono text-xs text-ink-soft">
          {hero.eyebrow}
        </p>
        <h1
          data-reveal
          style={delay(80)}
          className="mt-6 font-serif text-[3.5rem] leading-[0.95] tracking-[-0.015em] text-balance sm:text-[5.5rem] lg:text-[7rem]"
        >
          {hero.title}
        </h1>
        <p data-reveal style={delay(160)} className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-ink-soft sm:text-xl">
          {hero.dek}
        </p>
        <div data-reveal style={delay(240)} className="mt-9 flex flex-wrap justify-center gap-3">
          <PrimaryCta>Start sending</PrimaryCta>
          <GitHubCta />
        </div>
        <ul data-reveal style={delay(320)} className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          {hero.facts.map((fact) => (
            <li key={fact} className="flex items-center gap-1.5">
              <Check aria-hidden className="size-3.5 text-live-deep" strokeWidth={2.5} />
              {fact}
            </li>
          ))}
        </ul>
      </Container>

      <div ref={sceneRef} className="relative mt-14 sm:mt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_16%,black_80%,transparent)]">
          <motion.div className="absolute -inset-y-[8%] inset-x-0" style={reduced ? undefined : { y: artY }}>
            <Art name="hero-post" night="hero-post-night" sizes="100vw" className="h-full w-full object-cover object-[70%_bottom] sm:object-bottom" />
          </motion.div>
        </div>
        <Container className="relative z-10 pt-10 pb-24 sm:pt-24 sm:pb-40">
          <div data-reveal style={delay(400)}>
            <OverviewMock />
          </div>
        </Container>
      </div>
    </section>
  )
}
