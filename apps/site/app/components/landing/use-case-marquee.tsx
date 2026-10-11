import { ArrowRight, ArrowUpRight } from 'lucide-react'

import { Marquee } from '~/components/magicui/marquee'
import { cases } from '~/content'
import { useCases, type UseCase } from '~/seo/use-cases'

import { MascotStamp, Postmark } from './postal'
import { Container, delay } from './shared'

const letters: Record<string, { subject: string; preview: string }> = {
  'password-reset-emails': { subject: 'Reset your password', preview: 'Tap the link to choose a new one.' },
  'magic-link-emails': { subject: 'Your sign-in link', preview: 'It works once, for 10 minutes.' },
  'verification-code-emails': { subject: 'Your code is 482913', preview: 'Enter it to finish signing up.' },
  'receipt-emails': { subject: 'Your receipt for $12.00', preview: 'Thanks for your order, Linus.' },
  'welcome-emails': { subject: 'Welcome to Field Notes', preview: 'Here’s how to get started.' },
  'scheduled-emails': { subject: 'Your trial ends Friday', preview: 'Sent on schedule, three days ahead.' },
}

const tints = ['bg-sky-soft', 'bg-pink-soft', 'bg-live-soft']
const tilts = [-1.2, 0.8, -0.6, 1.1, -0.9, 0.7]

function Letter({ useCase, index }: { useCase: UseCase; index: number }) {
  const letter = letters[useCase.slug]!
  const to = (useCase.request.to as string[])[0]!
  return (
    <a
      href={`/use-cases/${useCase.slug}`}
      style={{ rotate: `${tilts[index % tilts.length]}deg` }}
      className="postcard group/letter relative grid w-[19rem] shrink-0 grid-cols-[minmax(0,1fr)_6.5rem] rounded-[4px] p-4 transition-transform duration-300 hover:rotate-0! hover:-translate-y-1 sm:w-[25rem] sm:grid-cols-[minmax(0,1fr)_8.5rem] sm:p-5"
    >
      <div className="flex min-w-0 flex-col pr-4">
        <p className="font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">{useCase.name}</p>
        <p className="mt-3 font-serif text-[1.65rem] leading-[1.05] text-balance sm:text-3xl">{letter.subject}</p>
        <p className="mt-2 text-sm text-ink-soft">{letter.preview}</p>
        <p className="mt-auto pt-4 font-serif text-lg text-ink-soft italic">Field Notes</p>
      </div>
      <div className="relative flex flex-col border-l border-line-strong/70 pl-4">
        <MascotStamp value={`${index + 1}¢`} tint={tints[index % tints.length]} className="ml-auto w-12 rotate-[4deg] sm:w-14" />
        <Postmark
          center="DELIVERED"
          top="ATLAIR POST"
          bottom="OCT 11"
          waves={false}
          className="pointer-events-none absolute -top-1 right-7 size-14 -rotate-12 opacity-70 sm:right-9 sm:size-16"
        />
        <div className="mt-auto space-y-3 pt-6">
          <p className="truncate border-b border-line-strong/70 pb-1 font-mono text-[10px] text-ink-soft sm:text-[11px]">{to}</p>
          <p className="border-b border-line-strong/70 pb-1" />
          <p className="flex items-center justify-end gap-1 font-mono text-[10px] text-ink-faint transition-colors group-hover/letter:text-ink">
            Read <ArrowUpRight aria-hidden className="size-3" />
          </p>
        </div>
      </div>
    </a>
  )
}

export function UseCaseMarquee() {
  const half = Math.ceil(useCases.length / 2)
  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className="overflow-hidden py-16 sm:py-24 lg:py-32">
      <Container className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p data-reveal className="font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
            {cases.beat}
          </p>
          <h2
            id="use-cases-title"
            data-reveal
            style={delay(80)}
            className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          >
            {cases.title[0]}
            <br />
            <span className="text-ink-faint">{cases.title[1]}</span>
          </h2>
        </div>
        <a data-reveal style={delay(160)} href="/use-cases" className="group inline-flex items-center gap-1.5 font-medium hover:text-sky-deep">
          All use cases
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </Container>

      <div data-reveal style={delay(200)} className="relative mt-8 flex flex-col sm:mt-12">
        <Marquee pauseOnHover repeat={6} className="py-5 [--duration:45s] [--gap:1.75rem]">
          {useCases.slice(0, half).map((u, i) => (
            <Letter key={u.slug} useCase={u} index={i} />
          ))}
        </Marquee>
        <Marquee pauseOnHover reverse repeat={6} className="py-5 [--duration:50s] [--gap:1.75rem]">
          {useCases.slice(half).map((u, i) => (
            <Letter key={u.slug} useCase={u} index={i + half} />
          ))}
        </Marquee>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-paper sm:w-32" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-paper sm:w-32" />
      </div>
    </section>
  )
}
