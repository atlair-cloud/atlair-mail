import {
  Check,
  Columns2,
  Copy,
  GripVertical,
  Heading1,
  Image,
  Minus,
  Monitor,
  MousePointerClick,
  Pilcrow,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Smartphone,
} from 'lucide-react'

import { cn } from '~/lib/utils'

import { Caps, Card, CardHeader, PanelFrame, StatusDot, type EmailStatus } from './frame'

function PageHead({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[24px] leading-tight font-semibold tracking-tight text-app-ink">{title}</p>
        <p className="mt-1 text-sm text-app-muted">{detail}</p>
      </div>
      {action}
    </div>
  )
}

function Button({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium',
        primary ? 'bg-app-ink text-app-canvas' : 'bg-app-canvas ring-1 ring-app-line',
      )}
    >
      {children}
    </span>
  )
}

const emails: { status: EmailStatus; subject: string; to: string; when: string; tag?: string }[] = [
  { status: 'delivered', subject: 'Your notes are ready', to: 'ada@example.com', when: '12:04', tag: 'welcome' },
  { status: 'delivered', subject: 'Reset your password', to: 'grace@example.com', when: '12:02', tag: 'auth' },
  { status: 'sent', subject: 'Your receipt for October', to: 'linus@example.org', when: '11:58', tag: 'billing' },
  { status: 'bounced', subject: 'Welcome to Field Notes', to: 'old-inbox@example.net', when: '11:50', tag: 'welcome' },
  { status: 'failed', subject: 'Weekly digest', to: 'blocked@example.com', when: '11:41', tag: 'digest' },
  { status: 'delivered', subject: 'Sign in to Field Notes', to: 'katherine@example.com', when: '11:37', tag: 'auth' },
  { status: 'queued', subject: 'Your trial ends Friday', to: 'alan@example.com', when: 'Fri 09:00', tag: 'billing' },
]

const timeline = [
  { time: '12:04:02.118', title: 'Accepted', detail: 'API key “production” · Idempotency-Key signup-ada-0412' },
  { time: '12:04:02.410', title: 'Picked up by a worker', detail: 'Attempt 1 of 6' },
  { time: '12:04:02.903', title: 'Checks passed', detail: 'Provider connected · domain verified · not suppressed' },
  { time: '12:04:03.220', title: 'Sent', detail: 'Amazon SES accepted it · 0100019a7f3e…' },
  { time: '12:04:05.871', title: 'Delivered', detail: 'gmail-smtp-in.l.google.com accepted it', good: true },
]

export function EmailsScreen() {
  return (
    <PanelFrame active="Emails">
      <PageHead title="Emails" detail="Every email sent from this organization, newest first." />
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-app-line px-4 py-2.5">
            <span className="inline-flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md bg-app-subtle px-2.5 text-sm text-app-faint">
              <Search className="size-3.5" /> Search by recipient or subject
            </span>
            {['All', 'Delivered', 'Bounced', 'Failed'].map((f, i) => (
              <span
                key={f}
                className={cn('rounded-sm px-2 py-1 text-xs font-medium', i === 0 ? 'bg-app-ink text-app-canvas' : 'text-app-muted ring-1 ring-app-line')}
              >
                {f}
              </span>
            ))}
          </div>
          <ol className="divide-y divide-app-line">
            {emails.map((e, i) => (
              <li
                key={i}
                className={cn(
                  'grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5',
                  i === 0 && 'bg-app-subtle',
                )}
              >
                <StatusDot status={e.status} />
                <p className="min-w-0 truncate text-sm">
                  <span className="font-medium">{e.subject}</span>
                  <span className="text-app-muted"> to {e.to}</span>
                </p>
                <span className="flex items-center gap-3">
                  <span className="hidden rounded-sm bg-app-subtle px-1.5 font-mono text-[11px] text-app-muted md:inline">{e.tag}</span>
                  <span className="font-mono text-[11px] text-app-muted tabular-nums">{e.when}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="hidden xl:block">
          <CardHeader title="Your notes are ready" right={<StatusDot status="delivered" />} />
          <ol className="px-4 py-4">
            {timeline.map((t, i) => (
              <li key={t.time} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                {i < timeline.length - 1 && <span className="absolute top-4 bottom-0 left-[7px] w-px bg-app-line" />}
                <span
                  className={cn(
                    'relative mt-1 grid size-4 place-items-center rounded-full',
                    t.good ? 'bg-live text-white' : 'bg-app-subtle ring-1 ring-app-line',
                  )}
                >
                  {t.good && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline justify-between gap-2 text-sm font-medium">
                    {t.title}
                    <span className="font-mono text-[10.5px] font-normal text-app-muted">{t.time}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-app-muted">{t.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </PanelFrame>
  )
}

const blocks = [
  { icon: Heading1, label: 'Heading' },
  { icon: Pilcrow, label: 'Paragraph' },
  { icon: MousePointerClick, label: 'Button' },
  { icon: Image, label: 'Image' },
  { icon: Columns2, label: 'Two columns' },
  { icon: Minus, label: 'Divider' },
]

export function TemplatesScreen() {
  return (
    <PanelFrame active="Templates" bodyClassName="p-0 sm:p-0 lg:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">Welcome</span>
          <span className="rounded-sm bg-app-subtle px-1.5 py-0.5 font-mono text-[11px] text-app-muted">alias: welcome</span>
          <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800">
            Draft · v4
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-md bg-app-subtle p-0.5 ring-1 ring-app-line">
            <span className="grid size-7 place-items-center rounded-[5px] text-app-faint">
              <Monitor className="size-3.5" />
            </span>
            <span className="grid size-7 place-items-center rounded-[5px] bg-app-canvas shadow-sm ring-1 ring-app-line">
              <Smartphone className="size-3.5" />
            </span>
          </span>
          <Button>
            <Send className="size-3.5" /> Send test
          </Button>
          <Button primary>Publish v4</Button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem_15rem]">
        <div className="relative px-6 py-8 sm:px-12">
          <p className="font-serif text-[2rem] leading-tight">
            Welcome,{' '}
            <span className="rounded-sm bg-pink-soft px-1 align-middle font-mono text-[0.5em] text-pink-deep ring-1 ring-pink/40">
              {'{{first_name}}'}
            </span>
          </p>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-app-muted">
            Your notebook is ready. Everything you write syncs to every device you sign in on.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <GripVertical className="-ml-5 size-4 text-app-faint" />
            <span className="font-mono text-[15px]">/</span>
            <span className="h-5 w-px animate-pulse bg-app-text" />
          </div>
          <div className="mt-2 ml-4 w-56 rounded-lg bg-app-canvas p-1.5 shadow-[0_18px_40px_-16px_rgba(20,36,58,0.35)] ring-1 ring-app-line">
            <Caps className="px-2 pt-1 pb-1.5">Blocks</Caps>
            {blocks.map(({ icon: Icon, label }, i) => (
              <span
                key={label}
                className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm', i === 2 ? 'bg-app-subtle' : 'text-app-muted')}
              >
                <Icon className="size-4" /> {label}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden border-l border-app-line bg-app-subtle/60 px-5 py-6 lg:block">
          <Caps className="mb-3 text-center">Phone preview</Caps>
          <div className="mx-auto w-44 rounded-[24px] bg-app-frame p-1.5 ring-1 ring-app-edge">
            <div className="overflow-hidden rounded-[19px] bg-white text-[#14243a]">
              <div className="airmail h-1" />
              <div className="px-3 pt-3 pb-4">
                <img src="/brand/atlair-mark.png" alt="" width={18} height={18} className="size-[18px]" />
                <p className="mt-2 font-serif text-[18px] leading-tight">Welcome, Ada.</p>
                <div className="mt-2 space-y-1">
                  <span className="block h-1.5 w-full rounded-full bg-slate-200" />
                  <span className="block h-1.5 w-5/6 rounded-full bg-slate-200" />
                  <span className="block h-1.5 w-2/3 rounded-full bg-slate-200" />
                </div>
                <span className="mt-3 inline-block rounded-[4px] bg-[#243041] px-2 py-1 text-[9px] font-semibold text-white">
                  Open your notes
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden border-l border-app-line px-5 py-6 lg:block">
          <Caps>Variables</Caps>
          <div className="mt-2 rounded-md p-2.5 ring-1 ring-app-line">
            <p className="font-mono text-xs">first_name</p>
            <p className="mt-1 text-xs text-app-muted">string · fallback “there”</p>
          </div>
          <Caps className="mt-6">Versions</Caps>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex justify-between">
              v4 <span className="text-xs text-app-muted">draft · you</span>
            </li>
            <li className="flex justify-between">
              v3 <span className="text-xs text-live-deep">live · 2 days ago</span>
            </li>
            <li className="flex justify-between text-app-muted">
              v2 <span className="text-xs">Restore</span>
            </li>
          </ul>
        </div>
      </div>
    </PanelFrame>
  )
}

const records = [
  { kind: 'DKIM', type: 'CNAME', name: 'k7f2._domainkey', value: 'k7f2.dkim.amazonses.com' },
  { kind: 'DKIM', type: 'CNAME', name: 'p3qa._domainkey', value: 'p3qa.dkim.amazonses.com' },
  { kind: 'DKIM', type: 'CNAME', name: 'x9mb._domainkey', value: 'x9mb.dkim.amazonses.com' },
  { kind: 'MAIL FROM', type: 'MX', name: 'bounce', value: '10 feedback-smtp.eu-west-1.amazonses.com' },
  { kind: 'SPF', type: 'TXT', name: 'bounce', value: '"v=spf1 include:amazonses.com ~all"' },
  { kind: 'DMARC', type: 'TXT', name: '_dmarc', value: '"v=DMARC1; p=none;"', optional: true },
]

export function DomainsScreen() {
  return (
    <PanelFrame active="Domains">
      <PageHead
        title="fieldnotes.app"
        detail="Verified · checked 4 minutes ago · eu-west-1"
        action={
          <Button>
            <RefreshCw className="size-3.5" /> Check now
          </Button>
        }
      />
      <Card className="mt-5">
        <div className="grid grid-cols-[6rem_4rem_minmax(0,14rem)_minmax(0,1fr)_auto] gap-x-4 border-b border-app-line px-4 py-2">
          {['Record', 'Type', 'Name', 'Value', ''].map((h) => (
            <Caps key={h}>{h}</Caps>
          ))}
        </div>
        <ul className="divide-y divide-app-line">
          {records.map((r) => (
            <li key={r.name + r.value} className="grid grid-cols-[6rem_4rem_minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3">
              <span className="text-sm font-medium">
                {r.kind}
                {r.optional && <span className="ml-1.5 text-[11px] font-normal text-app-faint">optional</span>}
              </span>
              <span className="font-mono text-xs text-app-muted">{r.type}</span>
              <span className="truncate font-mono text-xs">{r.name}</span>
              <span className="truncate font-mono text-xs text-app-muted">{r.value}</span>
              <Copy className="size-3.5 text-app-faint" />
            </li>
          ))}
        </ul>
      </Card>
    </PanelFrame>
  )
}

const deliveries = [
  { type: 'email.delivered', code: 200, when: '12:04:06', ms: '84 ms' },
  { type: 'email.sent', code: 200, when: '12:04:03', ms: '91 ms' },
  { type: 'email.bounced', code: 503, when: '11:50:12', ms: '15.0 s', note: 'Attempt 3 of 8 · next in 30 min' },
  { type: 'email.complained', code: 200, when: '11:31:40', ms: '77 ms' },
  { type: 'email.delivered', code: 200, when: '11:28:02', ms: '80 ms' },
]

export function WebhooksScreen() {
  return (
    <PanelFrame active="Webhooks">
      <PageHead
        title="https://fieldnotes.app/hooks/post"
        detail="Enabled · 9 event types · created by ada@fieldnotes.app"
        action={
          <Button>
            <RotateCw className="size-3.5" /> Rotate secret
          </Button>
        }
      />
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Deliveries" />
          <ol className="divide-y divide-app-line">
            {deliveries.map((d, i) => (
              <li key={i} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5">
                <span
                  className={cn(
                    'rounded-sm px-1.5 py-0.5 text-center font-mono text-[11px] ring-1 ring-inset',
                    d.code < 300
                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
                      : 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800',
                  )}
                >
                  {d.code}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[13px]">{d.type}</p>
                  {d.note && <p className="text-xs text-red-600 dark:text-red-400">{d.note}</p>}
                </div>
                <span className="font-mono text-[11px] text-app-muted tabular-nums">
                  {d.ms} · {d.when}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="hidden xl:block">
          <CardHeader title="Signing secret" />
          <div className="space-y-3 px-4 py-3.5 text-sm">
            <p className="rounded-sm bg-app-subtle px-2 py-1.5 font-mono text-xs">whsec_••••••••••••••••3f9a</p>
            <p className="text-xs leading-relaxed text-app-muted">
              The previous secret keeps working until Oct 17, so you can deploy the new one without dropping events.
            </p>
            <Caps className="pt-2">Headers</Caps>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px]">
              <dt className="text-app-muted">webhook-id</dt>
              <dd className="truncate">msg_2nV8kq1Zt0</dd>
              <dt className="text-app-muted">webhook-timestamp</dt>
              <dd className="truncate">1791627846</dd>
              <dt className="text-app-muted">webhook-signature</dt>
              <dd className="truncate">v1,K5oZfzN95Z9UVu1EsfQm…</dd>
            </dl>
          </div>
        </Card>
      </div>
    </PanelFrame>
  )
}

const code = {
  cURL: `curl -X POST https://post.fieldnotes.app/service/web/emails \\
  -H "Authorization: Bearer am_••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "Field Notes <hello@fieldnotes.app>",
    "to": ["success@simulator.amazonses.com"],
    "subject": "Hello from the playground",
    "html": "<p>It works.</p>"
  }'`,
}

export function PlaygroundScreen() {
  return (
    <PanelFrame active="Playground">
      <PageHead title="Playground" detail="Send a real email and see the request your code would make." />
      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Compose" />
          <div className="space-y-3 px-4 py-4 text-sm">
            {[
              ['From', 'Field Notes <hello@fieldnotes.app>'],
              ['To', 'success@simulator.amazonses.com'],
              ['Subject', 'Hello from the playground'],
            ].map(([k, v]) => (
              <label key={k} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3">
                <span className="text-app-muted">{k}</span>
                <span className="truncate rounded-md bg-app-canvas px-2.5 py-1.5 ring-1 ring-app-line">{v}</span>
              </label>
            ))}
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <span className="pt-1.5 text-app-muted">Body</span>
              <span className="h-20 rounded-md bg-app-canvas px-2.5 py-1.5 ring-1 ring-app-line">It works.</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="inline-flex items-center gap-2 text-xs text-app-muted">
                <span className="size-2 rounded-full bg-live" /> Delivered 2.4 s after sending
              </span>
              <Button primary>
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </div>
        </Card>
        <Card className="hidden xl:block">
          <div className="flex items-center gap-1 border-b border-app-line px-3 py-2">
            {['cURL', 'Node.js', 'Python'].map((l, i) => (
              <span key={l} className={cn('rounded-sm px-2 py-1 text-xs font-medium', i === 0 ? 'bg-app-subtle' : 'text-app-muted')}>
                {l}
              </span>
            ))}
            <Copy className="ml-auto size-3.5 text-app-faint" />
          </div>
          <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12px] leading-relaxed text-app-muted">{code.cURL}</pre>
        </Card>
      </div>
    </PanelFrame>
  )
}
