import { markdownFor } from '~/lib/markdown'

import type { Route } from './+types/markdown'

export function loader({ params }: Route.LoaderArgs) {
  const body = markdownFor((params['*'] ?? '').replace(/\.md$/, ''))
  if (!body) throw new Response('Not found', { status: 404 })
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
