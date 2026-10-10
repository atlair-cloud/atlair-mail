import { ChevronDown, ExternalLink, Moon, Search, Sun } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/utils'

export type EmailStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'

export const EMAIL_STATUS: Record<EmailStatus, { label: string; dot: string; text: string }> = {
  queued: { label: 'Queued', dot: 'bg-slate-300', text: 'text-app-muted' },
  sending: { label: 'Sending', dot: 'bg-sky animate-pulse motion-reduce:animate-none', text: 'text-app-text' },
  sent: { label: 'Sent', dot: 'bg-sky', text: 'text-app-text' },
  delivered: { label: 'Delivered', dot: 'bg-live', text: 'text-app-text' },
  bounced: { label: 'Bounced', dot: 'bg-attention', text: 'text-amber-700 dark:text-amber-300' },
  complained: { label: 'Complained', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  failed: { label: 'Failed', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
}

const tabs = ['Overview', 'Emails', 'Templates', 'Domains', 'API keys', 'Webhooks', 'Suppressions', 'Playground', 'Settings']

export function Caps({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn('font-mono text-[10.5px] font-medium tracking-[0.12em] text-app-muted uppercase', className)}>{children}</p>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('overflow-hidden rounded-md bg-app-canvas ring-1 ring-app-line', className)}>{children}</div>
}

export function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-app-line px-4 py-2.5">
      <Caps className="text-[11px] tracking-[0.14em]">{title}</Caps>
      {right}
    </div>
  )
}

export function StatusDot({ status, label = true }: { status: EmailStatus; label?: boolean }) {
  const s = EMAIL_STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs font-medium', s.text)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full transition-colors duration-500', s.dot)} />
      {label && s.label}
    </span>
  )
}

export function PanelFrame({
  active,
  children,
  className,
  bodyClassName,
}: {
  active: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'app-frame overflow-hidden rounded-2xl border border-app-edge font-panel text-app-text shadow-[0_50px_100px_-50px_rgba(20,36,58,0.5)] select-none dark:shadow-[0_50px_100px_-40px_rgba(0,0,0,0.9)]',
        className,
      )}
    >
      <div className="flex h-12 items-center gap-3 px-4 text-sm sm:h-14 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/brand/atlair-mark.png" alt="" width={24} height={24} className="size-6" />
          <span className="text-app-faint">/</span>
          <span className="truncate font-medium">fieldnotes</span>
          <ChevronDown className="size-3.5 shrink-0 text-app-faint" />
        </div>
        <div className="mx-auto hidden h-9 w-full max-w-sm items-center gap-2 rounded-md bg-app-canvas px-3 text-app-faint ring-1 ring-app-line md:flex">
          <Search className="size-4" />
          <span className="truncate">Jump to a page or organization…</span>
          <span className="ml-auto rounded-sm bg-app-subtle px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-app-line">⌘K</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 text-app-muted md:ml-0">
          <Moon className="size-4 dark:hidden" />
          <Sun className="hidden size-4 dark:block" />
          <span className="grid size-7 place-items-center rounded-full bg-pink/40 text-xs font-semibold text-app-text">A</span>
        </div>
      </div>
      <nav className="flex gap-6 overflow-hidden px-4 text-[13.5px] sm:px-6">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={cn(
              'shrink-0 border-b-2 pb-2.5',
              tab === active ? 'border-app-ink font-medium text-app-text' : 'border-transparent text-app-muted',
              i > 4 && tab !== active && 'hidden lg:block',
            )}
          >
            {tab}
          </span>
        ))}
        <span className="hidden shrink-0 items-center gap-1 pb-2.5 text-app-muted xl:inline-flex">
          API docs <ExternalLink className="size-3" />
        </span>
      </nav>
      <div className="mx-1.5 mb-1.5 rounded-[10px] bg-app-canvas ring-1 ring-app-edge sm:mx-2 sm:mb-2 sm:rounded-xl">
        <div className={cn('p-4 sm:p-7 lg:px-10 lg:py-8', bodyClassName)}>{children}</div>
      </div>
    </div>
  )
}
