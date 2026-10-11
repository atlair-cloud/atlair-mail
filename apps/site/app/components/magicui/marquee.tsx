import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '~/lib/utils'

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  repeat = 4,
  children,
  ...props
}: ComponentPropsWithoutRef<'div'> & { reverse?: boolean; pauseOnHover?: boolean; repeat?: number }) {
  return (
    <div {...props} className={cn('group flex gap-(--gap) overflow-hidden p-2 [--duration:40s] [--gap:1rem]', className)}>
      {Array.from({ length: repeat }, (_, i) => (
        <div
          key={i}
          inert={i > 0}
          aria-hidden={i > 0}
          className={cn(
            'flex shrink-0 animate-marquee justify-around gap-(--gap) motion-reduce:animate-none',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]',
          )}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
