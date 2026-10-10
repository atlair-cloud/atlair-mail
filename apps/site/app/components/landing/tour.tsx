import { useState, type KeyboardEvent } from 'react'

import { tour } from '~/content'
import { cn } from '~/lib/utils'

import { DomainsScreen, EmailsScreen, PlaygroundScreen, TemplatesScreen, WebhooksScreen } from './panel/screens'
import { Container, Title } from './shared'

const screens = {
  emails: EmailsScreen,
  templates: TemplatesScreen,
  domains: DomainsScreen,
  webhooks: WebhooksScreen,
  playground: PlaygroundScreen,
}

type TabId = (typeof tour.tabs)[number]['id']

export function Tour() {
  const [active, setActive] = useState<TabId>('emails')
  const Screen = screens[active]
  const current = tour.tabs.find((t) => t.id === active)!

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = tour.tabs.findIndex((t) => t.id === active)
    const next = tour.tabs[(i + (e.key === 'ArrowRight' ? 1 : tour.tabs.length - 1)) % tour.tabs.length]!
    setActive(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  return (
    <section id="tour" aria-labelledby="tour-title" className="py-24 lg:py-32">
      <Container>
        <div data-reveal className="flex flex-col items-center text-center">
          <Title id="tour-title">{tour.title}</Title>
          <div role="tablist" aria-label="Panel pages" onKeyDown={onKey} className="mt-10 flex flex-wrap justify-center gap-1 rounded-full border border-line bg-card p-1">
            {tour.tabs.map((tab) => {
              const selected = tab.id === active
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls="tour-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  className={cn('rounded-full px-4 py-2 text-sm font-medium transition-colors', selected ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <p className="mt-4 text-ink-soft" aria-live="polite">
            {current.caption}
          </p>
        </div>
        <div id="tour-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="mt-10">
          <Screen />
        </div>
      </Container>
    </section>
  )
}
