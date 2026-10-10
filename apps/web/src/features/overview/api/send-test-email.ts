import { apiFetch } from '../../../lib/api/client'

export function sendTestEmail(organizationId: string, input: { from: string; to: string }) {
  return apiFetch<{ id: string; status: string }>(`/organizations/${organizationId}/emails`, {
    method: 'POST',
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: 'Test email from Atlair Mail',
      text: `This is a test email sent from the Atlair Mail panel to ${input.to}.\n\nIf you can read this, sending works.`,
    }),
  })
}
