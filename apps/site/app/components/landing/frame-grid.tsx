import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { FlickeringGrid } from '~/components/ui/flickering-grid'
import { useTheme } from '~/lib/theme'
import { cn } from '~/lib/utils'

export function FrameGrid({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const { dark } = useTheme()
  const [color, setColor] = useState<string | null>(null)

  useEffect(() => {
    setColor(getComputedStyle(document.documentElement).getPropertyValue('--color-frame-grid').trim() || '#7fb6d9')
  }, [dark])

  if (!color) return null

  return (
    <div aria-hidden className={cn('pointer-events-none overflow-hidden', className)}>
      <FlickeringGrid className="size-full" squareSize={2} gridGap={6} color={color} maxOpacity={0.35} flickerChance={reduced ? 0 : 0.08} fps={12} />
    </div>
  )
}
