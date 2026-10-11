import { Check, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { features } from '~/content'
import { cn } from '~/lib/utils'

import { Art } from './art'
import { MascotStamp } from './postal'
import { Container, delay, usePlayOnView } from './shared'

function useTick(play: boolean, ms: number) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!play) return
    const id = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [play, ms])
  return tick
}

function TemplatesVisual() {
  const { ref, play } = usePlayOnView<HTMLDivElement>()
  const preview = useTick(play, 2200) % 2 === 1
  return (
    <div ref={ref} className="mx-auto flex w-full max-w-md flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div className="w-full max-w-sm rounded-md border border-line-strong bg-card shadow-[0_18px_36px_-22px_rgba(20,36,58,0.45)]">
        <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">Reset your password</div>
        <div className="space-y-3 px-4 py-4 text-sm">
          <p>
            Hi{' '}
            <span
              className={cn(
                'rounded py-0.5 transition-colors duration-300',
                preview ? 'bg-transparent' : 'bg-sky-soft px-1 font-mono text-[12px] text-sky-deep',
              )}
            >
              {preview ? 'Ada' : '{{first_name}}'}
            </span>
            ,
          </p>
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-line" />
            <div className="h-2 w-4/5 rounded-full bg-line" />
          </div>
          <span className="inline-block rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper">Choose a new password</span>
        </div>
      </div>
      <ul className="flex shrink-0 gap-2 font-mono text-[11px] whitespace-nowrap sm:flex-col">
        <li className="flex items-center gap-1.5 rounded-sm border border-line-strong bg-card px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-live" />
          v4 · live
        </li>
        <li className="rounded-sm border border-line bg-card px-2.5 py-1 text-ink-soft">v3</li>
        <li className="rounded-sm border border-line bg-card px-2.5 py-1 text-ink-faint">v2</li>
      </ul>
    </div>
  )
}

const events = [
  { name: 'email.delivered', dot: 'bg-live' },
  { name: 'email.sent', dot: 'bg-sky' },
  { name: 'email.bounced', dot: 'bg-attention' },
  { name: 'email.delivered', dot: 'bg-live' },
  { name: 'email.complained', dot: 'bg-fail' },
  { name: 'email.sent', dot: 'bg-sky' },
]

function WebhooksVisual() {
  const { ref, play } = usePlayOnView<HTMLDivElement>()
  const tick = useTick(play, 1500)
  const shown = Array.from({ length: 4 }, (_, i) => tick - i)
  return (
    <div ref={ref} className="mx-auto w-full max-w-sm">
      <div className="mb-2 flex items-center justify-between rounded-md border border-line bg-card/90 px-3 py-2 font-mono text-[11px] text-ink-soft backdrop-blur">
        <span>fieldnotes.app/hooks</span>
        <span className="flex items-center gap-1 text-live-deep">
          <ShieldCheck className="size-3.5" />
          signed
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {shown.map((n) => {
            const e = events[((n % events.length) + events.length) % events.length]!
            return (
              <motion.li
                key={n}
                layout
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 34 }}
                className="flex items-center gap-3 rounded-md border border-line-strong bg-card px-3 py-2.5 font-mono text-xs"
              >
                <span className={cn('size-2 shrink-0 rounded-full', e.dot)} />
                <span className="flex-1 truncate">{e.name}</span>
                <span className="text-live-deep">200</span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}

const records = [
  { name: 'DKIM', type: 'CNAME ×3' },
  { name: 'SPF', type: 'TXT' },
  { name: 'DMARC', type: 'TXT' },
]

function DomainsVisual() {
  const { ref, play, animate } = usePlayOnView<HTMLDivElement>()
  const tick = useTick(play, 700)
  const done = animate ? Math.min(tick, records.length + 1) : records.length + 1
  return (
    <div ref={ref} className="mx-auto w-full max-w-xs rounded-md border border-line-strong bg-card shadow-[0_18px_36px_-22px_rgba(20,36,58,0.45)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold">fieldnotes.app</span>
        <span
          className={cn(
            'rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors duration-300',
            done > records.length ? 'bg-live-soft text-live-deep' : 'bg-surface text-ink-faint',
          )}
        >
          {done > records.length ? 'Verified' : 'Checking'}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {records.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span
              className={cn(
                'grid size-4 place-items-center rounded-full transition-colors duration-300',
                done > i ? 'bg-live text-white' : 'ring-1 ring-line-strong',
              )}
            >
              {done > i && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
            <span className="flex-1 font-medium">{r.name}</span>
            <span className="font-mono text-[11px] text-ink-faint">{r.type}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OnceVisual() {
  const { ref, play, animate } = usePlayOnView<HTMLDivElement>()
  const tick = useTick(play, 1400)
  const step = animate ? tick % 4 : 3
  return (
    <div ref={ref} className="mx-auto flex w-full max-w-xs flex-col gap-2 font-mono text-xs">
      {['send', 'retry'].map((label, i) => (
        <div
          key={label}
          className={cn(
            'rounded-md border bg-card px-3 py-2.5 transition-colors duration-500',
            step > i ? 'border-line-strong' : 'border-line',
          )}
        >
          <div className={cn('transition-opacity duration-500', step > i ? 'opacity-100' : 'opacity-25')}>
            <div className="flex items-center justify-between text-ink-faint">
              <span>{label}</span>
              <span>reset-8f21</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-live-deep">202</span>
              <span>em_8f21c4</span>
            </div>
          </div>
        </div>
      ))}
      <p className={cn('mt-1 self-center rounded-sm bg-card/90 px-2 py-0.5 text-ink-soft backdrop-blur transition-opacity duration-500', step > 2 ? 'opacity-100' : 'opacity-0')}>
        1 email sent
      </p>
    </div>
  )
}

const items = [
  { key: 'templates', art: 'bento-templates', stamp: '1¢', tint: 'bg-sky-soft', Visual: TemplatesVisual, ...features.templates },
  { key: 'webhooks', art: 'bento-webhooks', stamp: '2¢', tint: 'bg-pink-soft', Visual: WebhooksVisual, ...features.webhooks },
  { key: 'domains', art: 'bento-domains', stamp: '3¢', tint: 'bg-live-soft', Visual: DomainsVisual, ...features.domains },
  { key: 'once', art: 'bento-once', stamp: '4¢', tint: 'bg-sky-soft', Visual: OnceVisual, ...features.once },
] as const

const STEP_MS = 6500

export function Features() {
  const { ref, play } = usePlayOnView<HTMLDivElement>(0.35)
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const item = items[active]!

  useEffect(() => {
    if (!play || !auto) return
    const id = setTimeout(() => setActive((i) => (i + 1) % items.length), STEP_MS)
    return () => clearTimeout(id)
  }, [play, auto, active])

  return (
    <section id="product" aria-labelledby="product-title" className="py-16 sm:py-24 lg:py-32">
      <Container>
        <div ref={ref} className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 xl:gap-24">
          <div>
            <p data-reveal className="font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
              {features.beat}
            </p>
            <h2
              id="product-title"
              data-reveal
              style={delay(80)}
              className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl"
            >
              {features.title[0]}
              <br />
              <span className="text-ink-faint">{features.title[1]}</span>
            </h2>

            <ol data-reveal style={delay(160)} className="mt-8 border-t border-line sm:mt-12">
              {items.map((it, i) => {
                const on = i === active
                return (
                  <li key={it.key} className="relative border-b border-line">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setActive(i)
                        setAuto(false)
                      }}
                      className="grid w-full grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-4 text-left sm:py-5"
                    >
                      <span className={cn('pt-1 font-mono text-xs transition-colors', on ? 'text-ink' : 'text-ink-faint')}>0{i + 1}</span>
                      <span>
                        <span className={cn('block text-lg font-semibold tracking-tight transition-colors', on ? 'text-ink' : 'text-ink-faint hover:text-ink-soft')}>
                          {it.title}
                        </span>
                        <span
                          className={cn(
                            'grid text-ink-soft transition-[grid-template-rows,opacity] duration-500',
                            on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                          )}
                        >
                          <span className="overflow-hidden">
                            <span className="block pt-1">{it.body}</span>
                          </span>
                        </span>
                      </span>
                    </button>
                    {on && auto && play && (
                      <motion.span
                        key={`bar-${active}`}
                        aria-hidden
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                        className="absolute inset-x-0 -bottom-px h-px origin-left bg-ink"
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          <div data-reveal style={delay(200)} className="relative mx-auto w-full max-w-3xl">
            <div aria-hidden className="postcard absolute inset-0 rotate-[3deg] rounded-[4px] opacity-70" />
            <div aria-hidden className="postcard absolute inset-0 -rotate-[2deg] rounded-[4px] opacity-85" />
            <div className="relative aspect-[4/3.4] sm:aspect-[5/4]">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: 60, y: -10, rotate: 6 }}
                  animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, x: -40, y: 20, rotate: -5, transition: { duration: 0.35 } }}
                  transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                  className="postcard absolute inset-0 rounded-[4px] p-2.5 sm:p-3.5"
                >
                  <div className="relative flex size-full items-center justify-center overflow-hidden rounded-[2px] p-5 sm:p-10">
                    <Art name={item.art} sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0 size-full object-cover" />
                    <div aria-hidden className="relative w-full">
                      <item.Visual />
                    </div>
                  </div>
                  <MascotStamp value={item.stamp} tint={item.tint} className="absolute -top-3 -right-2 w-12 rotate-[6deg] sm:-top-4 sm:-right-4 sm:w-16" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
