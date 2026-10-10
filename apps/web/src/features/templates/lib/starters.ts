import type { JSONContent } from '@tiptap/core'
import type { TemplateDraft } from '../api/templates'

export type StarterId = 'blank' | 'welcome' | 'password-reset' | 'receipt'

const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const variable = (name: string): JSONContent => ({ type: 'variable', attrs: { name } })
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const heading = (level: 1 | 2 | 3, ...content: JSONContent[]): JSONContent => ({ type: 'heading', attrs: { level }, content })
const muted = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })

export const STARTERS: { value: StarterId; label: string; description: string }[] = [
  { value: 'blank', label: 'Blank', description: 'An empty email to build from scratch.' },
  { value: 'welcome', label: 'Welcome', description: 'Greet a new user and point them to their first step.' },
  { value: 'password-reset', label: 'Password reset', description: 'A secure link with a clear expiry note.' },
  { value: 'receipt', label: 'Receipt', description: 'Order summary with totals in two columns.' },
]

const drafts: Record<StarterId, Omit<TemplateDraft, 'alias'>> = {
  blank: {
    name: 'Untitled template',
    subject: '',
    theme: {},
    variables: [],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  },
  welcome: {
    name: 'Welcome',
    subject: 'Welcome to {{product_name}}, {{first_name}}',
    theme: { brandColor: '#4f46e5' },
    variables: [
      { key: 'first_name', type: 'string', fallback: 'there' },
      { key: 'product_name', type: 'string', fallback: 'Acme' },
      { key: 'dashboard_url', type: 'string' },
    ],
    content: {
      type: 'doc',
      content: [
        heading(1, text('Welcome, '), variable('first_name')),
        paragraph(text('Thanks for joining '), variable('product_name'), text('. Your account is ready, and the next step takes about two minutes.')),
        { type: 'button', attrs: { text: 'Open your dashboard', href: '{{dashboard_url}}', textAlign: 'left' } },
        { type: 'horizontalRule' },
        heading(3, text('A few things to try')),
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph(text('Invite your team'))] },
            { type: 'listItem', content: [paragraph(text('Connect your first integration'))] },
            { type: 'listItem', content: [paragraph(text('Read the getting started guide'))] },
          ],
        },
        muted(text('Questions? Just reply to this email.')),
      ],
    },
  },
  'password-reset': {
    name: 'Password reset',
    subject: 'Reset your password',
    theme: {},
    variables: [
      { key: 'reset_url', type: 'string' },
      { key: 'expires_in_minutes', type: 'number', fallback: 30 },
    ],
    content: {
      type: 'doc',
      content: [
        heading(2, text('Reset your password')),
        paragraph(text('Someone asked to reset the password for your account. If it was you, use the button below.')),
        { type: 'button', attrs: { text: 'Choose a new password', href: '{{reset_url}}', textAlign: 'left' } },
        paragraph(text('This link works for '), variable('expires_in_minutes'), text(' minutes and only once.')),
        { type: 'spacer', attrs: { height: 8 } },
        {
          type: 'section',
          attrs: { backgroundColor: '#f8fafc', padding: 12 },
          content: [paragraph(text('Didn’t ask for this? ', [{ type: 'bold' }]), text('You can ignore this email. Your password won’t change.'))],
        },
      ],
    },
  },
  receipt: {
    name: 'Receipt',
    subject: 'Your receipt for order {{order_id}}',
    theme: { brandColor: '#16a34a' },
    variables: [
      { key: 'order_id', type: 'string' },
      { key: 'order_date', type: 'string' },
      { key: 'total', type: 'string' },
      { key: 'order_url', type: 'string' },
    ],
    content: {
      type: 'doc',
      content: [
        heading(2, text('Thanks for your order')),
        paragraph(text('Here’s your receipt. Keep it for your records.')),
        {
          type: 'section',
          attrs: { backgroundColor: '#f4f4f5', padding: 16 },
          content: [
            {
              type: 'columns',
              content: [
                { type: 'column', content: [paragraph(text('Order', [{ type: 'bold' }])), paragraph(variable('order_id'))] },
                { type: 'column', content: [paragraph(text('Date', [{ type: 'bold' }])), paragraph(variable('order_date'))] },
                { type: 'column', content: [paragraph(text('Total', [{ type: 'bold' }])), paragraph(variable('total'))] },
              ],
            },
          ],
        },
        { type: 'button', attrs: { text: 'View your order', href: '{{order_url}}', textAlign: 'left' } },
        muted(text('Need help with this order? Reply to this email.')),
      ],
    },
  },
}

export function starterDraft(id: string | null | undefined): TemplateDraft {
  const starter = drafts[(id as StarterId) in drafts ? (id as StarterId) : 'blank']
  return JSON.parse(JSON.stringify({ ...starter, alias: null })) as TemplateDraft
}
