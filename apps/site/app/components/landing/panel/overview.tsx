import { ChevronRight, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '~/lib/utils'

import { usePlayOnView } from '../shared'
import { Caps, Card, CardHeader, PanelFrame, StatusDot, type EmailStatus } from './frame'

const flow: EmailStatus[] = ['queued', 'sending', 'sent', 'delivered']
const stepMs = [800, 700, 1100]

const days = [
  { label: 'Sat', delivered: 1180, other: 0, problems: 6 },
  { label: 'Sun', delivered: 960, other: 0, problems: 4 },
  { label: 'Mon', delivered: 1840, other: 0, problems: 9 },
  { label: 'Tue', delivered: 1910, other: 0, problems: 7 },
  { label: 'Wed', delivered: 2040, other: 0, problems: 8 },
  { label: 'Thu', delivered: 1990, other: 0, problems: 5 },
  { label: 'Fri', delivered: 1420, other: 12, problems: 3 },
]

const peak = Math.max(...days.map((d) => d.delivered + d.other + d.problems))

export function OverviewMock() {
  const { ref, play, animate } = usePlayOnView<HTMLDivElement>(0.3)
  const [step, setStep] = useState(flow.length - 1)

  useEffect(() => {
    if (animate) setStep(0)
  }, [animate])

  useEffect(() => {
    if (!play || step >= flow.length - 1) return
    const t = setTimeout(() => setStep((s) => s + 1), stepMs[step])
    return () => clearTimeout(t)
  }, [play, step])

  const status = flow[step]!
  const done = status === 'delivered'
  const delivered = days.reduce((a, d) => a + d.delivered, 0) + (done ? 1 : 0)
  const problems = days.reduce((a, d) => a + d.problems, 0)
  const inFlight = 12 + (done ? 0 : 1)
  const total = delivered + problems + inFlight

  const recent: { status: EmailStatus; subject: string; to: string; when: string }[] = [
    { status, subject: 'Your notes are ready', to: 'ada@example.com', when: done ? 'just now' : 'now' },
    { status: 'delivered', subject: 'Reset your password', to: 'grace@example.com', when: '2 minutes ago' },
    { status: 'delivered', subject: 'Your receipt for October', to: 'linus@example.org', when: '6 minutes ago' },
    { status: 'bounced', subject: 'Welcome to Field Notes', to: 'old-inbox@example.net', when: '14 minutes ago' },
    { status: 'delivered', subject: 'Sign in to Field Notes', to: 'katherine@example.com', when: '21 minutes ago' },
    { status: 'delivered', subject: 'Your notes are ready', to: 'alan@example.com', when: '33 minutes ago' },
  ]

  return (
    <div ref={ref}>
      <PanelFrame active="Overview">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <Caps className="text-[11px] tracking-[0.14em]">Overview</Caps>
            <p className="mt-1.5 text-[28px] leading-tight font-semibold tracking-tight text-app-ink">fieldnotes</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="relative inline-flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-live/60 [animation-duration:2.5s] motion-reduce:hidden" />
                  <span className="relative size-2 rounded-full bg-live" />
                </span>
                Sending normally
              </span>
              <span className="text-app-faint">·</span>
              <span className="text-app-muted">1,431 emails in the last 24 hours · last {done ? 'just now' : 'a minute ago'}</span>
            </p>
          </div>
          <span className="hidden h-9 items-center gap-2 rounded-md bg-app-canvas px-3.5 text-sm font-medium ring-1 ring-app-line sm:inline-flex">
            <Send className="size-4" />
            Send a test email
          </span>
        </div>

        <Card className="mt-6 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border-app-line px-5 py-4 max-lg:border-b lg:border-r">
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <div>
                <Caps>Last 7 days</Caps>
                <p className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{total.toLocaleString('en-US')}</span>
                  <span className="text-sm text-app-muted">emails</span>
                </p>
                <p className="mt-0.5 text-sm text-app-muted">
                  {delivered.toLocaleString('en-US')} of {(delivered + problems).toLocaleString('en-US')} delivered · 99.6%
                </p>
              </div>
              <div className="flex h-20 w-full max-w-72 items-end gap-1.5">
                {days.map((d, i) => {
                  const t = d.delivered + d.other + d.problems + (i === 6 && !done ? 1 : 0)
                  return (
                    <span key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="font-mono text-[10px] leading-none text-app-muted tabular-nums">
                        {(t / 1000).toFixed(1)}k
                      </span>
                      <span className="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-[2px] bg-app-subtle">
                        <span className="w-full bg-live" style={{ height: `${(d.delivered / peak) * 100}%` }} />
                        <span className="w-full bg-sky" style={{ height: `${(d.other / peak) * 100 * 4}%` }} />
                        <span className="w-full bg-red-400" style={{ height: `${(d.problems / peak) * 100 * 3}%` }} />
                      </span>
                      <span className={cn('text-[10px] leading-none', i === 6 ? 'font-semibold' : 'text-app-muted')}>{d.label}</span>
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-[3px] bg-app-subtle">
              <span className="bg-live" style={{ width: '97.2%' }} />
              <span className="bg-attention" style={{ width: '0.6%' }} />
              <span className="bg-sky" style={{ width: '2.2%' }} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {[
                { n: delivered, label: 'delivered', dot: 'bg-live' },
                { n: 0, label: 'failed', dot: 'bg-red-500' },
                { n: problems, label: 'bounced or spam', dot: 'bg-attention' },
                { n: inFlight, label: 'in flight', dot: 'bg-sky' },
              ].map((o) => (
                <li key={o.label} className={cn('inline-flex items-center gap-1.5', o.n ? '' : 'text-app-faint')}>
                  <span className={cn('size-2 rounded-[2px]', o.n ? o.dot : 'bg-app-line')} />
                  <span className="font-mono font-medium tabular-nums">{o.n.toLocaleString('en-US')}</span>
                  {o.label}
                </li>
              ))}
            </ul>
          </div>
          {[
            { label: 'Bounce rate', value: '0.39%', width: '8%', limit: '5%' },
            { label: 'Complaint rate', value: '0.02%', width: '20%', limit: '0.1%' },
          ].map((card, i) => (
            <div key={card.label} className={cn('border-app-line px-5 py-4', i === 0 && 'max-lg:border-b lg:border-r')}>
              <Caps>{card.label}</Caps>
              <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight tabular-nums">{card.value}</p>
              <span className="mt-2 flex h-1.5 overflow-hidden rounded-[3px] bg-app-subtle">
                <span className="bg-live" style={{ width: card.width }} />
              </span>
              <p className="mt-1.5 text-xs text-app-muted">Amazon SES reviews accounts at {card.limit}</p>
            </div>
          ))}
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader
              title="Recent emails"
              right={
                <span className="inline-flex items-center gap-1 text-xs font-medium text-app-muted">
                  All emails <ChevronRight className="size-3" />
                </span>
              }
            />
            <ol className="divide-y divide-app-line">
              {recent.map((email, i) => (
                <li
                  key={i}
                  className={cn(
                    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]',
                    i === 0 && !done && 'bg-sky/[0.05]',
                  )}
                >
                  <StatusDot status={email.status} />
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-medium">{email.subject}</span>
                    <span className="text-app-muted"> to {email.to}</span>
                  </p>
                  <span className="font-mono text-[11px] text-app-muted tabular-nums">{email.when}</span>
                </li>
              ))}
            </ol>
          </Card>
          <div className="hidden flex-col gap-6 sm:flex">
            <Card>
              <CardHeader title="Sending domains" />
              <ul className="divide-y divide-app-line">
                {['fieldnotes.app', 'mail.fieldnotes.app'].map((d) => (
                  <li key={d} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate text-sm font-medium">{d}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-app-muted">
                      <span className="size-2 rounded-full bg-live" />
                      Verified
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader
                title="Sending limits"
                right={
                  <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800">
                    Production
                  </span>
                }
              />
              <div className="px-4 py-3.5 text-sm">
                <p>
                  Amazon SES · <span className="font-mono text-[13px]">eu-west-1</span>
                </p>
                <p className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-app-muted">Sent in the last 24 hours</span>
                  <span className="font-mono tabular-nums">1,431 / 50,000</span>
                </p>
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-[3px] bg-app-subtle">
                  <span className="w-[3%] bg-live" />
                </span>
                <p className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-app-muted">Sending rate</span>
                  <span className="font-mono tabular-nums">14 / second</span>
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-app-muted">
                  Provider settings <ChevronRight className="size-3" />
                </p>
              </div>
            </Card>
          </div>
        </div>
      </PanelFrame>
    </div>
  )
}
