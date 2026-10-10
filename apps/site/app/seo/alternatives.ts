export type Alternative = {
  slug: string
  name: string
  openSource: boolean
  selfHost: boolean
  sendsFrom: string
  pricing: string
  pricingUrl: string
  summary: string
  chooseThem: string[]
  extraFaq?: { q: string; a: string }
}

export const checkedOn = '2026-10-10'

export const choosePost = [
  'You want to send through your own Amazon SES account and pay AWS’s price.',
  'You want to read the code, or host it yourself under AGPL-3.0.',
  'You need transactional email with templates, signed webhooks and suppression.',
]

export const alternatives: Alternative[] = [
  {
    slug: 'resend',
    name: 'Resend',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Resend’s infrastructure',
    pricing: 'Plans by monthly volume',
    pricingUrl: 'https://resend.com/pricing',
    summary: 'A hosted email API for developers, with marketing broadcasts and contacts.',
    chooseThem: ['You want marketing broadcasts and contacts in the same hosted product.', 'You need managed dedicated IPs.'],
  },
  {
    slug: 'sendgrid',
    name: 'SendGrid',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Twilio’s infrastructure',
    pricing: 'Plans by monthly volume',
    pricingUrl: 'https://www.twilio.com/en-us/sendgrid/pricing',
    summary: 'Twilio’s email API and marketing campaigns platform.',
    chooseThem: ['You want marketing campaigns and the API from one vendor.', 'You already run on Twilio.'],
  },
  {
    slug: 'mailgun',
    name: 'Mailgun',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Mailgun’s infrastructure',
    pricing: 'Plans by monthly volume',
    pricingUrl: 'https://www.mailgun.com/pricing/',
    summary: 'A hosted email API with validation, inbound parsing and inbox previews.',
    chooseThem: ['You need email validation or inbound email parsing.', 'You want inbox previews before you send.'],
  },
  {
    slug: 'postmark',
    name: 'Postmark',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Postmark’s infrastructure',
    pricing: 'Plans by monthly volume',
    pricingUrl: 'https://postmarkapp.com/pricing',
    summary: 'A hosted delivery service that keeps transactional and promotional email apart.',
    chooseThem: ['You want promotional and transactional streams kept separate for you.', 'You want support included in every plan.'],
  },
  {
    slug: 'amazon-ses',
    name: 'Amazon SES on its own',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Your AWS account',
    pricing: 'Per email, paid to AWS',
    pricingUrl: 'https://aws.amazon.com/ses/pricing/',
    summary: 'AWS’s sending service, used directly through its API, SMTP or console.',
    chooseThem: ['You only need an SMTP endpoint or the AWS SDK.', 'You’re happy to build the panel, retries and webhooks yourself.'],
    extraFaq: {
      q: 'What does Atlair Post add on top of Amazon SES?',
      a: 'A send API with idempotency and scheduling, a queue with retries, a template editor, domain setup, automatic suppression, signed webhooks and a panel for your team. SES still does the sending, in your account.',
    },
  },
  {
    slug: 'mailchimp-transactional',
    name: 'Mailchimp Transactional',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Mailchimp’s infrastructure',
    pricing: 'Add-on to a Mailchimp plan',
    pricingUrl: 'https://mailchimp.com/features/transactional-email/',
    summary: 'Mailchimp’s transactional email and SMS add-on, formerly Mandrill.',
    chooseThem: ['Your marketing email already lives in Mailchimp.', 'You also need transactional SMS.'],
  },
  {
    slug: 'brevo',
    name: 'Brevo',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Brevo’s infrastructure',
    pricing: 'Plans by monthly volume',
    pricingUrl: 'https://www.brevo.com/pricing/',
    summary: 'A marketing and transactional platform for email, SMS and WhatsApp.',
    chooseThem: ['You want email, SMS and WhatsApp from one provider.', 'You want a full marketing suite alongside it.'],
  },
  {
    slug: 'loops',
    name: 'Loops',
    openSource: false,
    selfHost: false,
    sendsFrom: 'Loops’ infrastructure',
    pricing: 'Plans by contact count',
    pricingUrl: 'https://loops.so/pricing',
    summary: 'Email for SaaS teams: lifecycle, marketing and transactional in one product.',
    chooseThem: ['You want lifecycle and marketing workflows next to transactional email.', 'You want segments that stay in sync with your product.'],
  },
  {
    slug: 'plunk',
    name: 'Plunk',
    openSource: true,
    selfHost: true,
    sendsFrom: 'Plunk’s cloud, or your own servers',
    pricing: 'Per email on their cloud',
    pricingUrl: 'https://www.useplunk.com/pricing',
    summary: 'An open-source platform for transactional email, campaigns and workflows.',
    chooseThem: ['You need automation workflows and segments today.', 'You need inbound email today.'],
  },
  {
    slug: 'usesend',
    name: 'useSend',
    openSource: true,
    selfHost: true,
    sendsFrom: 'Amazon SES, with your own credentials',
    pricing: 'Per email on their cloud',
    pricingUrl: 'https://usesend.com',
    summary: 'An open-source sending platform on Amazon SES, with marketing email and contacts.',
    chooseThem: ['You need marketing email, contacts or an SMTP relay today.', 'You need inbound email today.'],
    extraFaq: {
      q: 'How is Atlair Post different from useSend?',
      a: 'Both are AGPL-3.0 and send through Amazon SES. Atlair Post runs on Postgres alone, with no Redis, and focuses on transactional email: versioned templates, signed webhooks and pre-send checks.',
    },
  },
]

export function findAlternative(slug: string | undefined) {
  return alternatives.find((a) => a.slug === slug)
}
