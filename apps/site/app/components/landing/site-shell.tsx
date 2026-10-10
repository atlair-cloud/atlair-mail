import { useEffect, type ReactNode } from 'react'

import { FrameGrid } from './frame-grid'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-in', '')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

export function SiteShell({ children }: { children: ReactNode }) {
  useScrollReveal()
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <FrameGrid className="fixed inset-y-0 left-0 w-2 sm:w-3" />
      <FrameGrid className="fixed inset-y-0 right-0 w-2 sm:w-3" />
      <FrameGrid className="fixed inset-x-0 bottom-0 h-2 sm:h-3" />
      <SiteHeader />
      <div className="relative px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="canvas-shadow overflow-clip rounded-2xl border border-canvas-edge bg-paper">
          <div aria-hidden className="airmail h-1.5" />
          <main id="main">{children}</main>
          <SiteFooter />
        </div>
      </div>
    </>
  )
}
