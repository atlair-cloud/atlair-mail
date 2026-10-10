import { Copy } from 'lucide-react'

import { openSource } from '~/content'

import { Postcard } from './postal'
import { Container, delay, GitHubCta, Title } from './shared'

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="open-source-title" className="py-24 lg:py-32">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div data-reveal>
          <Postcard art="open-door" sizes="(min-width: 1024px) 50vw, 100vw" tilt={-1.4} stamp="0¢" tint="bg-live-soft" mark="AGPL" />
        </div>
        <div data-reveal style={delay(120)}>
          <Title id="open-source-title">{openSource.title}</Title>
          <p className="mt-5 text-lg text-ink-soft">{openSource.dek}</p>
          <p className="mt-8 flex max-w-xl items-center justify-between gap-4 rounded-lg border border-line bg-card px-4 py-3 font-mono text-[13px]">
            <span className="truncate">
              <span className="text-pink-deep">$</span> {openSource.command}
            </span>
            <Copy aria-hidden className="size-4 shrink-0 text-ink-faint" />
          </p>
          <GitHubCta className="mt-6" />
        </div>
      </Container>
    </section>
  )
}
