import { Plus } from 'lucide-react'

import { askAi, faq } from '~/content'

import { AskAi } from './ask-ai'
import { Container, delay } from './shared'

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="py-16 sm:py-24 lg:py-32">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p data-reveal className="font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
            {faq.beat}
          </p>
          <h2
            id="faq-title"
            data-reveal
            style={delay(80)}
            className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          >
            {faq.title[0]}
            <br />
            <span className="text-ink-faint">{faq.title[1]}</span>
          </h2>
          <AskAi {...askAi} className="mt-10" />
        </div>
        <div className="faq border-t border-line">
          {faq.items.map((item, i) => (
            <details key={item.q} data-reveal style={delay(i * 50)} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[17px] font-medium tracking-tight hover:text-sky-deep [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-line text-ink-soft transition-transform duration-300 group-open:rotate-45">
                  <Plus aria-hidden className="size-3.5" />
                </span>
              </summary>
              <p className="pr-12 pb-6 text-[15px] leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  )
}
