import { ArrowRight } from 'lucide-react'
import { useInView, useReducedMotion } from 'motion/react'
import { siGithub } from 'simple-icons'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { APP_URL } from '~/content'
import { cn } from '~/lib/utils'

export const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1560px] px-5 sm:px-8 lg:px-12', className)}>{children}</div>
}

export function PrimaryCta({
  children,
  className,
  href = APP_URL,
  tone = 'ink',
}: {
  children: ReactNode
  className?: string
  href?: string
  tone?: 'ink' | 'paper'
}) {
  return (
    <a
      href={href}
      className={cn(
        'group inline-flex h-12 items-center gap-2 rounded-md px-5 text-[15px] font-semibold transition-colors',
        tone === 'ink' ? 'bg-ink text-paper hover:bg-ink/85' : 'bg-[#faf8f2] text-[#14243a] hover:bg-white',
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

export function GitHubCta({ className, tone = 'line' }: { className?: string; tone?: 'line' | 'night' }) {
  return (
    <a
      href="https://github.com/atlair-cloud/atlair-mail"
      className={cn(
        'inline-flex h-12 items-center gap-2.5 rounded-md border px-5 text-[15px] font-semibold transition-colors',
        tone === 'line'
          ? 'border-line-strong bg-card text-ink hover:border-ink-faint'
          : 'border-night-line bg-night-soft text-white hover:border-night-fg/50',
        className,
      )}
    >
      <GitHubIcon className="size-[18px]" />
      View the source
    </a>
  )
}

export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('font-mono text-xs tracking-tight text-ink-faint', className)}>{children}</span>
}

export function BrandIcon({
  icon,
  className,
  color,
}: {
  icon: { path: string; hex: string; title: string }
  className?: string
  color?: string
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill={color ?? `#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  )
}

export function GitHubIcon({ className }: { className?: string }) {
  return <BrandIcon icon={siGithub} className={className} color="currentColor" />
}

export function usePlayOnView<T extends Element>(amount = 0.4) {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { once: true, amount })
  const reduced = useReducedMotion()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return { ref, play: hydrated && !reduced && inView, animate: hydrated && !reduced }
}

export function Title({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={cn('font-serif text-5xl leading-[1.02] tracking-[-0.01em] text-balance sm:text-6xl', className)}>
      {children}
    </h2>
  )
}
