import { useId, type CSSProperties, type ReactNode } from 'react'

import { cn } from '~/lib/utils'

import { Art, type ArtName } from './art'

export function Stamp({ className, innerClassName, children }: { className?: string; innerClassName?: string; children: ReactNode }) {
  return (
    <div className={cn('stamp-shadow inline-block', className)}>
      <div className="stamp bg-[#f4ecd6] p-[6px] dark:bg-[#2c3136]">
        <div className={cn('relative overflow-hidden ring-1 ring-[#e0d5b8] dark:ring-[#41474e]', innerClassName)}>{children}</div>
      </div>
    </div>
  )
}

export function MascotStamp({ className, value = '1¢', tint = 'bg-sky-soft' }: { className?: string; value?: string; tint?: string }) {
  return (
    <Stamp className={cn('w-16', className)} innerClassName={cn('grid aspect-[4/5] place-items-center', tint)}>
      <img src="/brand/atlair-mark.png" alt="" width={32} height={32} className="size-8" />
      <span className="absolute top-1 right-1.5 font-serif text-[13px] leading-none text-ink-soft italic">{value}</span>
      <span className="absolute bottom-1 font-mono text-[6.5px] tracking-[0.2em] text-ink-faint">POST</span>
    </Stamp>
  )
}

export function Postmark({
  top = 'ATLAIR POST',
  bottom = 'DELIVERED',
  center,
  waves = true,
  className,
  style,
}: {
  top?: string
  bottom?: string
  center: ReactNode
  waves?: boolean
  className?: string
  style?: CSSProperties
}) {
  const id = useId()
  return (
    <svg aria-hidden viewBox={waves ? '0 0 236 120' : '0 0 120 120'} className={cn('text-stamp', className)} style={style} fill="none">
      <defs>
        <path id={`${id}-top`} d="M -41 0 A 41 41 0 0 1 41 0" />
        <path id={`${id}-bottom`} d="M -48 0 A 48 48 0 0 0 48 0" />
      </defs>
      <g transform="translate(60 60)" stroke="currentColor">
        <circle r="54" strokeWidth="2.6" />
        <circle r="36" strokeWidth="1.2" />
        <text fill="currentColor" stroke="none" fontSize="10" letterSpacing="2.2" fontFamily="var(--font-mono)" textAnchor="middle">
          <textPath href={`#${id}-top`} startOffset="50%">
            {top}
          </textPath>
        </text>
        <text fill="currentColor" stroke="none" fontSize="10" letterSpacing="2.2" fontFamily="var(--font-mono)" textAnchor="middle">
          <textPath href={`#${id}-bottom`} startOffset="50%">
            {bottom}
          </textPath>
        </text>
        <text fill="currentColor" stroke="none" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle" y="4">
          {center}
        </text>
      </g>
      {waves && (
        <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {[30, 46, 62, 78, 94].map((y) => (
            <path key={y} d={`M124 ${y} q 14 -9 28 0 t 28 0 t 28 0 t 26 0`} />
          ))}
        </g>
      )}
    </svg>
  )
}

export function Postcard({
  art,
  sizes,
  tilt = 0,
  stamp = '1¢',
  tint,
  mark = 'OCT 10',
  className,
  children,
}: {
  art: ArtName
  sizes: string
  tilt?: number
  stamp?: string
  tint?: string
  mark?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn('postcard group relative rounded-[6px] p-3 transition-transform duration-500 hover:rotate-0 sm:p-4', className)}
      style={{ rotate: `${tilt}deg` }}
    >
      <div className="overflow-hidden rounded-[3px]">
        <Art name={art} sizes={sizes} className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
      </div>
      <MascotStamp value={stamp} tint={tint} className="absolute -top-3 -right-3 rotate-[6deg]" />
      <Postmark center={mark} className="pointer-events-none absolute top-6 right-14 h-14 w-auto -rotate-[10deg] opacity-80" />
      {children && <div className="px-1 pt-4 pb-1">{children}</div>}
    </div>
  )
}
