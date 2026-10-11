export const PRODUCT = 'Atlair Post'

export const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173'
export const DOCS_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/docs/`
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://post.atlair.cloud'
export const GITHUB_URL = 'https://github.com/atlair-cloud/atlair-mail'
export const HELP_EMAIL = 'hello@atlair.cloud'

export const nav = [
  { label: 'How it works', href: '/#how' },
  { label: 'Product', href: '/#product' },
  { label: 'Use cases', href: '/#use-cases' },
  { label: 'Open source', href: '/#open-source' },
  { label: 'FAQ', href: '/#faq' },
]

export const hero = {
  eyebrow: 'Open source · AGPL-3.0',
  title: 'The post office is open.',
  dek: 'The open-source way to send product email from your own cloud. Follow every message from request to inbox.',
  facts: ['Your cloud account', 'Signed webhooks', 'Never sends twice', 'Self-hostable'],
}

export const flow = {
  beat: 'How it flows',
  title: ['One request out.', 'Every step back.'],
}

export const cases = {
  beat: 'Use cases',
  title: ['Every email', 'your product sends.'],
}

export const features = {
  beat: 'What’s inside',
  title: ['Built in.', 'Not bolted on.'],
  templates: { title: 'Templates anyone can edit.', body: 'Publish, roll back, pin a version.' },
  webhooks: { title: 'Every event, signed.', body: 'Retried for a day if you miss one.' },
  domains: { title: 'Your domain, verified.', body: 'DKIM, SPF and DMARC, checked for you.' },
  once: { title: 'Never sends twice.', body: 'Same key, same email.' },
}

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
  beat: 'Open source',
  title: ['Nothing sealed.', 'Every line is yours.'],
  command: 'git clone https://github.com/atlair-cloud/atlair-mail',
}

export const faq = {
  beat: 'FAQ',
  title: ['Questions.', 'Answered.'],
  items: [
    {
      q: 'What is Atlair Post?',
      a: 'Atlair Post is Atlair’s open-source email app. It sends your product’s email, like password resets, receipts and sign-in links, from your own cloud account, and shows you each one reach the inbox.',
    },
    {
      q: 'Is Atlair the same as Altair?',
      a: 'No. Atlair (A-T-L-A-I-R) makes Atlair Post. Altair Engineering is a different company that makes simulation software and is part of Siemens. Atlair Post has no connection to Altair or Siemens.',
    },
    {
      q: 'How do I contact Atlair Post support?',
      a: `Email ${HELP_EMAIL}, or open an issue on GitHub at github.com/atlair-cloud/atlair-mail.`,
    },
    { q: 'Why send from my own AWS account?', a: 'You pay AWS directly, and your sending reputation stays yours.' },
    { q: 'Can I host it myself?', a: 'Yes. It’s AGPL-3.0. You need Postgres, the API and the worker.' },
    { q: 'Which languages work?', a: 'Anything that can make an HTTP request. A Node SDK is coming.' },
    { q: 'Are my AWS keys safe?', a: 'They’re encrypted, tied to your organization, and never shown again.' },
    { q: 'What isn’t built yet?', a: 'Attachments, batch sending, the SDK and open and click tracking.' },
    { q: 'How much does it cost?', a: `Pricing isn’t decided yet. Hosting it yourself is free. Ask us at ${HELP_EMAIL}.` },
  ],
}

export const closing = {
  title: ['Go on.', 'Send the first one.'],
  dek: 'Four steps from AWS keys to a delivered email.',
}

export const askAi = {
  label: 'Ask your assistant',
  prompt: `Read ${SITE_URL}/llms.txt and tell me what ${PRODUCT} is, what it does today, and whether it fits my product’s email.`,
}

export const social = [
  { label: 'X', href: 'https://x.com/atlaircloud' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/atlaircloud' },
  { label: 'GitHub', href: 'https://github.com/atlair-cloud' },
] as const
