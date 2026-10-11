import { ArrowRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { AnimatedShinyText } from '~/components/magicui/animated-shiny-text'
import { Globe } from '~/components/magicui/globe'
import { GITHUB_URL, hero } from '~/content'
import { useTheme } from '~/lib/theme'
import { cn } from '~/lib/utils'

import { FrameGrid } from './frame-grid'
import { MascotStamp, Postmark } from './postal'
import { Container, delay, GitHubCta, PrimaryCta, usePlayOnView } from './shared'

type Rgb = [number, number, number]

const arrivals = [
  { subject: 'Reset your password', city: 'Lisbon', time: '1.2 s', location: [38.72, -9.14] },
  { subject: 'Your receipt for $12.00', city: 'Mumbai', time: '1.8 s', location: [19.08, 72.88] },
  { subject: 'Your sign-in link', city: 'São Paulo', time: '0.9 s', location: [-23.55, -46.63] },
  { subject: 'Your code is 482913', city: 'New York', time: '1.1 s', location: [40.71, -74.01] },
  { subject: 'Welcome to Field Notes', city: 'Tokyo', time: '1.4 s', location: [35.68, 139.69] },
  { subject: 'Your trial ends Friday', city: 'Nairobi', time: '1.6 s', location: [-1.29, 36.82] },
] as const

const slots = ['left-[2%] top-[10%]', 'right-[2%] top-[22%]', 'left-[9%] top-[46%]', 'right-[8%] top-[56%]']

const markers = arrivals.map((a) => ({ location: [a.location[0], a.location[1]] as [number, number], size: 0.07 }))

const globeBase = { devicePixelRatio: 2, phi: 4.4, theta: 0.28, mapSamples: 16000, markers }

const globeLight = {
  ...globeBase,
  dark: 0,
  diffuse: 0.4,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1] as Rgb,
  markerColor: [0.85, 0.4, 0.56] as Rgb,
  glowColor: [0.98, 0.97, 0.95] as Rgb,
}

const globeDark = {
  ...globeBase,
  dark: 1,
  diffuse: 1.2,
  mapBrightness: 5,
  baseColor: [0.32, 0.35, 0.39] as Rgb,
  markerColor: [0.37, 0.72, 0.9] as Rgb,
  glowColor: [0.1, 0.11, 0.12] as Rgb,
}

function useArrivals(animate: boolean) {
  const [shown, setShown] = useState(() => slots.map((_, i) => i))
  const [latest, setLatest] = useState(0)

  useEffect(() => {
    if (!animate) return
    let tick = 0
    const id = setInterval(() => {
      const slot = tick % slots.length
      const value = (tick + slots.length) % arrivals.length
      setShown((s) => s.map((v, i) => (i === slot ? value : v)))
      setLatest(slot)
      tick += 1
    }, 1700)
    return () => clearInterval(id)
  }, [animate])

  return { shown, latest }
}

export function Hero() {
  const { dark } = useTheme()
  const { ref, animate } = usePlayOnView<HTMLDivElement>(0.1)
  const { shown, latest } = useArrivals(animate)
  const config = useMemo(() => (dark ? globeDark : globeLight), [dark])

  return (
    <section className="relative overflow-hidden">
      <FrameGrid className="absolute inset-x-0 top-0 h-[34rem] opacity-50 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)]" />
      <Container className="relative flex flex-col items-center pt-14 text-center sm:pt-20 lg:pt-24">
        <a
          data-reveal
          href={GITHUB_URL}
          className="group inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3 py-1 text-[13px] transition-colors hover:border-line-strong"
        >
          <span aria-hidden className="size-1.5 rounded-full bg-live" />
          <AnimatedShinyText className="text-ink-soft">{hero.eyebrow}</AnimatedShinyText>
          <ArrowRight aria-hidden className="size-3.5 text-ink-faint transition-transform group-hover:translate-x-0.5" />
        </a>
        <h1
          data-reveal
          style={delay(80)}
          className="mt-6 max-w-6xl text-[3.25rem] leading-[0.95] font-semibold tracking-[-0.05em] text-balance sm:text-8xl lg:text-[7.5rem] xl:text-[8.5rem]"
        >
          {hero.title}
        </h1>
        <p data-reveal style={delay(160)} className="mt-7 max-w-2xl text-xl leading-relaxed text-pretty text-ink-soft sm:text-2xl">
          {hero.dek}
        </p>
        <div data-reveal style={delay(240)} className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <PrimaryCta className="justify-center">Start sending</PrimaryCta>
          <GitHubCta className="justify-center" />
        </div>
      </Container>

      <div ref={ref} data-reveal style={delay(400)} className="relative mx-auto mt-6 w-full max-w-[68rem] sm:mt-10">
        <div className="relative aspect-[1/0.82] overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent_96%)] sm:aspect-[1/0.58]">
          <Globe config={config} className="absolute top-[4%] left-1/2 w-[150%] -translate-x-1/2 sm:w-[86%]" />
        </div>
        <div className="pointer-events-none absolute inset-x-4 top-[6%] flex justify-center sm:hidden">
          <Arrival index={shown[latest]!} animate={animate} />
        </div>
        {slots.map((slot, i) => (
          <div key={slot} className={cn('pointer-events-none absolute hidden sm:block', slot)}>
            <Arrival index={shown[i]!} animate={animate} />
          </div>
        ))}
      </div>
    </section>
  )
}

const tints = ['bg-sky-soft', 'bg-pink-soft', 'bg-live-soft']

function Arrival({ index, animate }: { index: number; animate: boolean }) {
  const a = arrivals[index]!
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={a.city}
        initial={animate ? { opacity: 0, y: 18, rotate: -6, scale: 0.94 } : false}
        animate={{ opacity: 1, y: 0, rotate: index % 2 ? 1.5 : -1.5, scale: 1 }}
        exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="postcard relative grid w-[18rem] grid-cols-[minmax(0,1fr)_4.25rem] rounded-[4px] p-3.5 text-left"
      >
        <div className="min-w-0 border-r border-line-strong/70 pr-3">
          <p className="truncate font-serif text-lg leading-tight">{a.subject}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
            <span aria-hidden className="size-1.5 rounded-full bg-live" />
            Delivered · {a.city}
          </p>
          <p className="mt-1.5 border-b border-line-strong/60 pb-0.5 font-mono text-[10px] text-ink-faint">in {a.time}</p>
        </div>
        <div className="relative pl-3">
          <MascotStamp value={`${index + 1}¢`} tint={tints[index % tints.length]} className="ml-auto w-11 rotate-[5deg]" />
          <Postmark
            center="SENT"
            bottom={a.city.toUpperCase()}
            waves={false}
            className="pointer-events-none absolute -bottom-2 -left-3 size-12 -rotate-12 opacity-70"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
