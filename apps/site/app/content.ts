export const PRODUCT = 'Atlair Post'

export const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173'
export const DOCS_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/docs/`
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://post.atlair.cloud'
export const GITHUB_URL = 'https://github.com/atlair-cloud/atlair-mail'
export const HELP_EMAIL = 'hello@atlair.cloud'

export const nav = [
  { label: 'Product', href: '/#product' },
  { label: 'Panel', href: '/#tour' },
  { label: 'Open source', href: '/#open-source' },
  { label: 'FAQ', href: '/#faq' },
]

export const hero = {
  eyebrow: `${PRODUCT} · Open source`,
  title: 'Every email, accounted for.',
  dek: 'Open-source email for your product. Send with one request, follow it to the inbox, and keep the keys.',
  facts: ['Your cloud account', 'Signed webhooks', 'Never sends twice', 'AGPL-3.0'],
}

export const features = [
  { art: 'vignette-key', title: 'Your SES.', body: 'Your AWS account, your price, your reputation.' },
  { art: 'vignette-desk', title: 'Templates anyone can edit.', body: 'Write, preview on a phone, publish.' },
  { art: 'vignette-bell', title: 'Every event, signed.', body: 'Delivered, bounced or complained, straight to your webhook.' },
] as const

export const tour = {
  title: 'One panel for the whole team.',
  tabs: [
    { id: 'emails', label: 'Emails', caption: 'Every email, every event.' },
    { id: 'templates', label: 'Templates', caption: 'Edit without a deploy.' },
    { id: 'domains', label: 'Domains', caption: 'DNS records to copy.' },
    { id: 'webhooks', label: 'Webhooks', caption: 'Every delivery attempt.' },
    { id: 'playground', label: 'Playground', caption: 'Send before you write code.' },
  ],
} as const

export const openSource = {
  title: 'Open source. Yours to host.',
  dek: 'Postgres and two Node processes. No Redis.',
  command: 'git clone https://github.com/atlair-cloud/atlair-mail',
}

export const faq = {
  title: 'Questions, answered.',
  items: [
    { q: 'Why my own SES account?', a: 'You pay AWS directly, and your sending reputation stays yours.' },
    { q: 'Can I host it myself?', a: 'Yes. It’s AGPL-3.0. You need Postgres, the API and the worker.' },
    { q: 'Which languages work?', a: 'Anything that can make an HTTP request. A Node SDK is coming.' },
    { q: 'Are my AWS keys safe?', a: 'They’re encrypted, tied to your organization, and never shown again.' },
    { q: 'What isn’t built yet?', a: 'Attachments, batch sending, the SDK and open and click tracking.' },
    { q: 'How much does it cost?', a: `Pricing isn’t decided yet. Hosting it yourself is free. Ask us at ${HELP_EMAIL}.` },
  ],
}

export const closing = {
  title: 'Go on. Send the first one.',
  dek: 'Four steps from AWS keys to a delivered email.',
}

export const askAi = {
  label: 'Ask your assistant',
  prompt: `What is ${PRODUCT} (github.com/atlair-cloud/atlair-mail), and how does an open-source email API compare to a hosted email service?`,
}

export const social = [
  { label: 'X', href: 'https://x.com/atlaircloud' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/atlaircloud' },
  { label: 'GitHub', href: 'https://github.com/atlair-cloud' },
] as const
