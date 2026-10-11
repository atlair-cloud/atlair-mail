import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useState, type RefObject } from 'react'

import { cn } from '~/lib/utils'

export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  vertical = false,
  curvature = 0,
  reverse = false,
  duration = 2.4,
  delay = 0,
  repeatDelay = 1.2,
  pathColor = 'var(--color-line-strong)',
  pathWidth = 2.5,
  startColor = 'var(--color-sky)',
  stopColor = 'var(--color-sky-deep)',
}: {
  className?: string
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  vertical?: boolean
  curvature?: number
  reverse?: boolean
  duration?: number
  delay?: number
  repeatDelay?: number
  pathColor?: string
  pathWidth?: number
  startColor?: string
  stopColor?: string
}) {
  const id = useId()
  const reduced = useReducedMotion()
  const [d, setD] = useState('')
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => {
      const from = fromRef.current
      const to = toRef.current
      if (!from || !to) return
      const box = container.getBoundingClientRect()
      const a = from.getBoundingClientRect()
      const b = to.getBoundingClientRect()
      const sx = a.left - box.left + a.width / 2
      const sy = a.top - box.top + a.height / 2
      const ex = b.left - box.left + b.width / 2
      const ey = b.top - box.top + b.height / 2
      setSize({ width: box.width, height: box.height })
      setD(
        vertical
          ? `M ${sx},${sy} Q ${sx - curvature},${(sy + ey) / 2} ${ex},${ey}`
          : `M ${sx},${sy} Q ${(sx + ex) / 2},${sy - curvature} ${ex},${ey}`,
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(container)
    update()
    return () => observer.disconnect()
  }, [containerRef, fromRef, toRef, curvature, vertical])

  const from = reverse ? ['90%', '-10%'] : ['10%', '110%']
  const to = reverse ? ['100%', '0%'] : ['0%', '100%']
  const still = ['0%', '0%']
  const coords = vertical ? { x1: still, x2: still, y1: from, y2: to } : { x1: from, x2: to, y1: still, y2: still }

  return (
    <svg
      aria-hidden
      fill="none"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      className={cn('pointer-events-none absolute top-0 left-0 transform-gpu', className)}
    >
      <path d={d} style={{ stroke: pathColor }} strokeWidth={pathWidth} strokeLinecap="round" />
      {!reduced && (
        <>
          <path d={d} stroke={`url(#${id})`} strokeWidth={pathWidth} strokeLinecap="round" />
          <defs>
            <motion.linearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
              animate={coords}
              transition={{ delay, duration, ease: 'easeInOut', repeat: Infinity, repeatDelay }}
            >
              <stop style={{ stopColor: startColor }} stopOpacity="0" />
              <stop style={{ stopColor: startColor }} />
              <stop offset="32.5%" style={{ stopColor: stopColor }} />
              <stop offset="100%" style={{ stopColor: stopColor }} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </>
      )}
    </svg>
  )
}
