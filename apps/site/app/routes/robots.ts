import { absoluteUrl } from '~/lib/seo'

export function loader() {
  const body = `# Atlair Post welcomes search engines and AI assistants.
# Plain-text summary for AI: ${absoluteUrl('/llms.txt')}

User-agent: *
Allow: /

User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
User-agent: Applebot-Extended
Allow: /

Sitemap: ${absoluteUrl('/sitemap.xml')}
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
