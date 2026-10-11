import { ArrowRight, Check, Copy, RotateCcw } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { GITHUB_URL, openSource } from '~/content'
import { cn } from '~/lib/utils'

import { Art } from './art'
import { MascotStamp, Postmark } from './postal'
import { Container, delay } from './shared'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text).then(() => setCopied(true))
      }}
      aria-label={copied ? 'Copied' : 'Copy command'}
      className="grid size-8 shrink-0 place-items-center rounded-sm text-ink-faint transition-colors hover:bg-surface hover:text-ink"
    >
      {copied ? <Check className="size-4 text-live-deep" /> : <Copy className="size-4" />}
    </button>
  )
}

function Postcard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduced = useReducedMotion()
  const [hydrated, setHydrated] = useState(false)
  const [turned, setTurned] = useState<boolean | null>(null)
  useEffect(() => setHydrated(true), [])
  const flipped = turned ?? (reduced || (hydrated && inView))

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl [perspective:2200px]">
      <motion.div
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0, rotate: flipped ? -1 : 1.5 }}
        transition={!hydrated || reduced ? { duration: 0 } : { delay: turned === null ? 1.3 : 0, duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        onClick={() => setTurned(!flipped)}
        className="relative aspect-[4/3] cursor-pointer sm:aspect-[3/2]"
      >
        <div aria-hidden={flipped} className="postcard absolute inset-0 rounded-[4px] p-2.5 [backface-visibility:hidden] sm:p-4">
          <div className="size-full overflow-hidden rounded-[2px]">
            <Art name="source-garden" sizes="(min-width: 1024px) 1024px, 100vw" className="size-full object-cover" />
          </div>
        </div>

        <div aria-hidden={!flipped} className="postcard absolute inset-0 grid rounded-[4px] p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] sm:p-8">
          <div className="flex min-w-0 flex-col sm:border-r sm:border-line-strong/70 sm:pr-8">
            <p className="font-serif text-2xl text-ink-soft italic sm:text-3xl">Dear builder,</p>
            <p className="mt-2 font-serif text-lg leading-snug text-ink-soft italic sm:mt-3 sm:text-xl">Every line is here. Take it home.</p>
            <div className="mt-4 flex items-center gap-2 rounded-sm border border-line-strong/70 bg-card/70 py-1.5 pr-1 pl-3 font-mono text-[11px] leading-snug sm:mt-5 sm:text-[12.5px]">
              <span className="min-w-0 flex-1">
                <span className="text-pink-deep">$</span> git clone
                <br />
                <span className="text-ink-soft">
                  github.com/
                  <br className="sm:hidden" />
                  <span className="whitespace-nowrap">atlair-cloud/atlair-mail</span>
                </span>
              </span>
              <CopyButton text={openSource.command} />
            </div>
            <p className="mt-auto pt-3 font-serif text-lg text-ink-soft italic sm:text-xl">— Atlair Post</p>
          </div>

          <div className="pointer-events-none absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 sm:flex sm:flex-col sm:pl-8">
            <MascotStamp value="0¢" tint="bg-live-soft" className="ml-auto w-12 rotate-[4deg] sm:w-16" />
            <Postmark
              center="AGPL"
              bottom="OPEN SOURCE"
              className="absolute top-4 right-14 hidden h-16 w-auto -rotate-12 opacity-70 sm:block"
            />
            <div className="mt-auto hidden space-y-5 sm:block">
              <p className="border-b border-line-strong/70 pb-1.5 font-serif text-xl text-ink-soft italic">To you,</p>
              <p className="border-b border-line-strong/70 pb-1.5 font-mono text-xs text-ink-faint">anywhere you host it</p>
              <p className="border-b border-line-strong/70 pb-4" />
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mt-6 flex justify-center sm:mt-8">
        <button
          type="button"
          onClick={() => setTurned(!flipped)}
          aria-pressed={flipped}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-card px-4 text-sm font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          <RotateCcw aria-hidden className={cn('size-4 transition-transform duration-500', flipped && '-scale-x-100')} />
          {flipped ? 'See the front' : 'Turn it over'}
        </button>
      </div>
    </div>
  )
}

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="open-source-title" className="py-16 sm:py-24 lg:py-32">
      <Container className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p data-reveal className="font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
            {openSource.beat}
          </p>
          <h2
            id="open-source-title"
            data-reveal
            style={delay(80)}
            className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          >
            {openSource.title[0]}
            <br />
            <span className="text-ink-faint">{openSource.title[1]}</span>
          </h2>
        </div>
        <a data-reveal style={delay(160)} href={GITHUB_URL} className="group inline-flex items-center gap-1.5 font-medium hover:text-sky-deep">
          View the source
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </Container>

      <Container className="mt-10 sm:mt-16">
        <div data-reveal style={delay(200)}>
          <Postcard />
        </div>
      </Container>
    </section>
  )
}
