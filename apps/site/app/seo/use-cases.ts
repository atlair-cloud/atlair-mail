export type UseCase = {
  slug: string
  name: string
  title: string
  dek: string
  art: 'vignette-key' | 'vignette-desk' | 'vignette-bell' | 'open-door'
  points: { title: string; body: string }[]
  request: Record<string, unknown>
  headers?: Record<string, string>
  faq: { q: string; a: string }[]
}

const from = 'Field Notes <hello@fieldnotes.app>'

export const useCases: UseCase[] = [
  {
    slug: 'password-reset-emails',
    name: 'Password reset emails',
    title: 'Password reset emails that arrive.',
    dek: 'Send the reset link the moment it’s asked for, and know it was delivered.',
    art: 'vignette-key',
    points: [
      { title: 'One click, one email.', body: 'An Idempotency-Key means a double-click or a retry never sends twice.' },
      { title: 'Safe links.', body: 'Template variables are escaped, and links are checked before sending.' },
      { title: 'Proof it landed.', body: 'Delivered or bounced, the event reaches your webhook.' },
    ],
    headers: { 'Idempotency-Key': 'reset-8f21' },
    request: {
      from,
      to: ['ada@example.com'],
      template: { id: 'password-reset', variables: { first_name: 'Ada', reset_url: 'https://fieldnotes.app/reset?t=8f21' } },
    },
    faq: [
      { q: 'What if the address bounces?', a: 'A hard bounce adds it to your suppression list, and your webhook gets an email.bounced event.' },
      { q: 'Can I see whether a reset email was delivered?', a: 'Yes. Each email shows its events in the panel, from accepted to delivered.' },
    ],
  },
  {
    slug: 'magic-link-emails',
    name: 'Magic link emails',
    title: 'Sign-in links, sent fast.',
    dek: 'Passwordless sign-in emails with a link your user can trust.',
    art: 'vignette-bell',
    points: [
      { title: 'Straight to the queue.', body: 'The API answers 202 and a worker sends it right away.' },
      { title: 'No duplicates.', body: 'Retries with the same Idempotency-Key return the first email.' },
      { title: 'Your domain.', body: 'DKIM and SPF on your own domain, so it looks like you.' },
    ],
    headers: { 'Idempotency-Key': 'signin-ada-1042' },
    request: {
      from,
      to: ['ada@example.com'],
      template: { id: 'magic-link', variables: { sign_in_url: 'https://fieldnotes.app/auth?t=1042' } },
    },
    faq: [
      { q: 'How quickly does it send?', a: 'Right after the API accepts it, as fast as your Amazon SES sending rate allows.' },
      { q: 'What if SES is throttling?', a: 'The worker retries up to 6 attempts with backoff. An unknown outcome is marked failed, never resent.' },
    ],
  },
  {
    slug: 'verification-code-emails',
    name: 'Verification code emails',
    title: 'Verification codes, delivered.',
    dek: 'One-time codes for sign-up and two-factor, sent from your own domain.',
    art: 'vignette-key',
    points: [
      { title: 'Numbers as variables.', body: 'Pass the code as a number or string; it’s escaped for you.' },
      { title: 'Checked before sending.', body: 'Suppressed addresses are blocked before they reach SES.' },
      { title: 'Every event logged.', body: 'Search by recipient to see what happened to any code.' },
    ],
    request: {
      from,
      to: ['ada@example.com'],
      template: { id: 'verification-code', variables: { code: 482913 } },
    },
    faq: [
      { q: 'Can I tag codes to find them later?', a: 'Yes. Add up to 10 tags per email, for example kind: otp.' },
      { q: 'Does it work in the SES sandbox?', a: 'Yes, to verified addresses and SES’s simulator addresses, until AWS grants production access.' },
    ],
  },
  {
    slug: 'receipt-emails',
    name: 'Receipt emails',
    title: 'Receipts your finance team can change.',
    dek: 'Edit the receipt in the panel, publish a new version, no deploy.',
    art: 'vignette-desk',
    points: [
      { title: 'Versions.', body: 'Publish with a diff, roll back in a click.' },
      { title: 'Pin a version.', body: 'Pass template.version when a send must use an exact design.' },
      { title: 'Tags for reporting.', body: 'Tag each email, for example kind: receipt.' },
    ],
    request: {
      from,
      to: ['linus@example.org'],
      template: { id: 'receipt', variables: { amount: '$12.00', invoice_url: 'https://fieldnotes.app/billing/4021' } },
      tags: [{ name: 'kind', value: 'receipt' }],
    },
    faq: [
      { q: 'Who can publish template changes?', a: 'Members whose role allows publishing. Each template records who last changed it.' },
      { q: 'Are attachments supported, like PDF invoices?', a: 'Not yet. Link to the invoice for now; attachments are on the roadmap.' },
    ],
  },
  {
    slug: 'welcome-emails',
    name: 'Welcome emails',
    title: 'Welcome emails, on brand.',
    dek: 'Start from the welcome template, make it yours, and send it on sign-up.',
    art: 'vignette-desk',
    points: [
      { title: 'Starter included.', body: 'Blank, Welcome, Password reset and Receipt to begin from.' },
      { title: 'Phone preview.', body: 'See it on a small screen before you publish.' },
      { title: 'Fallbacks.', body: 'A missing first name becomes “there”, not a blank.' },
    ],
    request: {
      from,
      to: ['grace@example.com'],
      template: { id: 'welcome', variables: { first_name: 'Grace' } },
    },
    faq: [
      { q: 'Can non-developers edit it?', a: 'Yes. The editor works like Notion: type / for blocks and {{ for variables.' },
      { q: 'How is the HTML built?', a: 'Templates render through MJML into HTML and plain text that work across email clients.' },
    ],
  },
  {
    slug: 'scheduled-emails',
    name: 'Scheduled emails',
    title: 'Send it later.',
    dek: 'Trial reminders and follow-ups, scheduled up to 30 days ahead.',
    art: 'vignette-bell',
    points: [
      { title: 'One field.', body: 'Add scheduledAt to the same request.' },
      { title: 'Checked at send time.', body: 'Domain and suppression are checked again when it’s due.' },
      { title: 'Visible in the panel.', body: 'Scheduled emails show as queued until they go.' },
    ],
    request: {
      from,
      to: ['alan@example.com'],
      template: { id: 'trial-ending', variables: { first_name: 'Alan' } },
      scheduledAt: '2026-10-17T09:00:00Z',
    },
    faq: [
      { q: 'Can I cancel a scheduled email?', a: 'Not yet. Canceling a scheduled send is on the roadmap.' },
      { q: 'How far ahead can I schedule?', a: 'Up to 30 days from the time you send the request.' },
    ],
  },
]

export function findUseCase(slug: string | undefined) {
  return useCases.find((u) => u.slug === slug)
}

export function curlFor(u: UseCase) {
  const headers = Object.entries(u.headers ?? {})
    .map(([k, v]) => `  -H "${k}: ${v}" \\\n`)
    .join('')
  return `curl -X POST https://your-host/service/web/emails \\
  -H "Authorization: Bearer am_••••" \\
${headers}  -d '${JSON.stringify(u.request, null, 2).replace(/\n/g, '\n  ')}'`
}
