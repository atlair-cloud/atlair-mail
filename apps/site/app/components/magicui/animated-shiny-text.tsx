import type { ComponentPropsWithoutRef, CSSProperties } from 'react'

import { cn } from '~/lib/utils'

export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
  ...props
}: ComponentPropsWithoutRef<'span'> & { shimmerWidth?: number }) {
  return (
    <span
      style={{ '--shiny-width': `${shimmerWidth}px` } as CSSProperties}
      className={cn(
        'animate-shiny-text bg-size-[var(--shiny-width)_100%] bg-clip-text bg-position-[0_0] bg-no-repeat [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite] motion-reduce:animate-none',
        'bg-linear-to-r from-transparent via-ink via-50% to-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
