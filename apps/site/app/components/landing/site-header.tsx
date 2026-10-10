import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { APP_URL, DOCS_URL, GITHUB_URL, nav } from '~/content'
import { useTheme } from '~/lib/theme'

import { FrameGrid } from './frame-grid'
import { Container, GitHubIcon } from './shared'

export function Brand({ className }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2 text-xl font-semibold tracking-tight ${className ?? ''}`}>
      <img src="/brand/atlair-mark.png" alt="" width={30} height={30} className="size-[30px]" />
      <span>
        Atlair <span className="font-serif text-[1.3em] leading-none font-normal italic">Post</span>
      </span>
    </a>
  )
}

function ThemeToggle() {
  const { dark, setPreference } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setPreference(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid size-10 place-items-center rounded-md text-frame-fg transition-colors hover:bg-frame-divider/60 hover:text-frame-fg-strong"
    >
      <Sun aria-hidden className="size-[18px] dark:hidden" />
      <Moon aria-hidden className="hidden size-[18px] dark:block" />
    </button>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <header className="sticky top-0 z-40 bg-frame px-2 sm:px-3">
      <FrameGrid className="absolute inset-0" />
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Brand className="text-frame-fg-strong" />
        <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] text-frame-fg lg:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-frame-fg-strong">
              {item.label}
            </a>
          ))}
          <a href={DOCS_URL} className="hover:text-frame-fg-strong">
            Docs
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <a
            href={GITHUB_URL}
            aria-label="Atlair Post on GitHub"
            className="hidden size-10 place-items-center rounded-md text-frame-fg hover:bg-frame-divider/60 hover:text-frame-fg-strong sm:grid"
          >
            <GitHubIcon className="size-[18px]" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-10 place-items-center rounded-md text-frame-fg hover:text-frame-fg-strong lg:hidden"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
          <a
            href={APP_URL}
            className="ml-1 inline-flex h-10 items-center rounded-md bg-frame-cta px-4 text-sm font-semibold text-frame-cta-fg transition-opacity hover:opacity-90"
          >
            Start sending
          </a>
        </div>
      </Container>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="relative mx-1 mb-3 flex flex-col rounded-xl border border-frame-divider bg-frame p-2 text-[17px] text-frame-fg-strong lg:hidden">
          {[...nav, { label: 'Docs', href: DOCS_URL }].map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 hover:bg-frame-divider/60">
              {item.label}
            </a>
          ))}
        </nav>
      )}
      <span aria-hidden className="canvas-cap canvas-cap--left" />
      <span aria-hidden className="canvas-cap canvas-cap--right" />
    </header>
  )
}
