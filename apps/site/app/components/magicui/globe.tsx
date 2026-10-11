import createGlobe, { type COBEOptions } from 'cobe'
import { useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useEffect, useRef } from 'react'

import { cn } from '~/lib/utils'

const MOVEMENT_DAMPING = 1400

export function Globe({ className, config }: { className?: string; config: Omit<COBEOptions, 'width' | 'height' | 'onRender'> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phiRef = useRef(config.phi)
  const widthRef = useRef(0)
  const pointer = useRef<number | null>(null)
  const reduced = useReducedMotion()

  const r = useMotionValue(0)
  const rs = useSpring(r, { mass: 1, damping: 30, stiffness: 100 })

  const setPointer = (value: number | null) => {
    pointer.current = value
    if (canvasRef.current) canvasRef.current.style.cursor = value !== null ? 'grabbing' : 'grab'
  }

  const move = (clientX: number) => {
    if (pointer.current === null) return
    r.set(r.get() + (clientX - pointer.current) / MOVEMENT_DAMPING)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onResize = () => {
      widthRef.current = canvas.offsetWidth
    }
    window.addEventListener('resize', onResize)
    onResize()

    const globe = createGlobe(canvas, {
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender: (state) => {
        if (pointer.current === null && !reduced) phiRef.current += 0.0035
        state.phi = phiRef.current + rs.get()
        state.width = widthRef.current * 2
        state.height = widthRef.current * 2
      },
    })

    const id = setTimeout(() => (canvas.style.opacity = '1'))
    return () => {
      clearTimeout(id)
      globe.destroy()
      window.removeEventListener('resize', onResize)
    }
  }, [rs, config, reduced])

  return (
    <div className={cn('aspect-square w-full', className)}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="size-full opacity-0 transition-opacity duration-700 contain-[layout_paint_size]"
        onPointerDown={(e) => setPointer(e.clientX)}
        onPointerUp={() => setPointer(null)}
        onPointerOut={() => setPointer(null)}
        onMouseMove={(e) => move(e.clientX)}
        onTouchMove={(e) => e.touches[0] && move(e.touches[0].clientX)}
      />
    </div>
  )
}
