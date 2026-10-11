import { Cloud, Code2, Mail } from 'lucide-react'
import { siGmail, siIcloud, siProtonmail } from 'simple-icons'
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'

import { AnimatedBeam } from '~/components/magicui/animated-beam'
import { flow } from '~/content'
import { cn } from '~/lib/utils'

import { BrandIcon, Container, delay } from './shared'

function useVertical() {
  const [vertical, setVertical] = useState(false)
  useEffect(() => {
    const query = matchMedia('(max-width: 767px)')
    const update = () => setVertical(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return vertical
}

const Node = forwardRef<HTMLDivElement, { className?: string; children: ReactNode }>(({ className, children }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative z-10 grid size-14 shrink-0 place-items-center rounded-lg border border-line-strong bg-card text-ink-soft shadow-[0_10px_24px_-14px_rgba(20,36,58,0.45)]',
      className,
    )}
  >
    {children}
  </div>
))

function Label({ title, className }: { title: string; className?: string }) {
  return <p className={cn('text-sm font-semibold whitespace-nowrap', className)}>{title}</p>
}

const inboxes = [
  { name: 'Gmail', icon: <BrandIcon icon={siGmail} color="currentColor" className="size-5" /> },
  { name: 'iCloud', icon: <BrandIcon icon={siIcloud} color="currentColor" className="size-5" /> },
  { name: 'Proton', icon: <BrandIcon icon={siProtonmail} color="currentColor" className="size-5" /> },
  { name: 'Any inbox', icon: <Mail aria-hidden className="size-5" /> },
]

function Diagram() {
  const vertical = useVertical()
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HTMLDivElement>(null)
  const postRef = useRef<HTMLDivElement>(null)
  const cloudRef = useRef<HTMLDivElement>(null)
  const inboxRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]

  return (
    <div
      ref={containerRef}
      className="app-frame relative overflow-hidden rounded-lg border border-line px-6 py-10 sm:px-10 md:py-14 lg:px-16"
    >
      <div className="flex flex-col items-start gap-12 pl-[12%] md:flex-row md:items-center md:justify-between md:gap-6 md:pl-0">
        <div className="flex items-center gap-4 md:flex-col md:gap-3">
          <div className="flex w-20 justify-center md:w-auto">
            <Node ref={appRef}>
              <Code2 aria-hidden className="size-6" />
            </Node>
          </div>
          <Label title="Your app" />
        </div>

        <div className="flex items-center gap-4 md:flex-col md:gap-3">
          <Node ref={postRef} className="size-20 rounded-xl border-sky/60 ring-8 ring-sky/10">
            <img src="/brand/atlair-mark.png" alt="" width={40} height={40} className="size-10" />
          </Node>
          <Label title="Atlair Post" />
        </div>

        <div className="flex items-center gap-4 md:flex-col md:gap-3">
          <div className="flex w-20 justify-center md:w-auto">
            <Node ref={cloudRef}>
              <Cloud aria-hidden className="size-6" />
            </Node>
          </div>
          <Label title="Your cloud" />
        </div>

        <div className="flex items-center gap-4 md:flex-col md:gap-3">
          <div className="flex gap-3 md:flex-col">
            {inboxes.map((inbox, i) => (
              <Node key={inbox.name} ref={inboxRefs[i]} className="size-11 rounded-md">
                <span className="sr-only">{inbox.name}</span>
                {inbox.icon}
              </Node>
            ))}
          </div>
          <Label title="Inbox" className="hidden md:block" />
        </div>
      </div>
      <Label title="Inbox" className="mt-3 pl-[12%] md:hidden" />

      <AnimatedBeam containerRef={containerRef} fromRef={appRef} toRef={postRef} vertical={vertical} />
      <AnimatedBeam containerRef={containerRef} fromRef={postRef} toRef={cloudRef} vertical={vertical} delay={0.6} />
      {inboxRefs.map((ref, i) => (
        <AnimatedBeam
          key={i}
          containerRef={containerRef}
          fromRef={cloudRef}
          toRef={ref}
          vertical={vertical}
          delay={1.2}
          startColor="var(--color-live)"
          stopColor="var(--color-live-deep)"
        />
      ))}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={postRef}
        toRef={appRef}
        vertical={vertical}
        curvature={vertical ? 64 : -90}
        reverse
        delay={2.2}
        startColor="var(--color-pink)"
        stopColor="var(--color-pink-deep)"
      />
    </div>
  )
}

export function Flow() {
  return (
    <section id="how" aria-labelledby="how-title" className="py-16 sm:py-24 lg:py-32">
      <Container>
        <div className="max-w-2xl">
          <p data-reveal className="font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
            {flow.beat}
          </p>
          <h2
            id="how-title"
            data-reveal
            style={delay(80)}
            className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          >
            {flow.title[0]}
            <br />
            <span className="text-ink-faint">{flow.title[1]}</span>
          </h2>
        </div>

        <div data-reveal style={delay(160)} className="mt-10 sm:mt-14">
          <Diagram />
        </div>

      </Container>
    </section>
  )
}
