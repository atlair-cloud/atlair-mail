import { useEffect, useRef, type CSSProperties } from 'react'

import { art } from '~/art.generated'
import { cn } from '~/lib/utils'

export type ArtName = keyof typeof art

function srcSet(name: ArtName) {
  const { widths, width } = art[name]
  return [...widths.map((w) => `/art/${name}-${w}.webp ${w}w`), `/art/${name}.webp ${width}w`].join(', ')
}

function Painting({ name, alt, sizes, className, style }: { name: ArtName; alt: string; sizes: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    if (!img) return
    const show = () => img.setAttribute('data-loaded', '')
    if (img.complete && img.naturalWidth) show()
    else img.addEventListener('load', show, { once: true })
    return () => img.removeEventListener('load', show)
  }, [])

  return (
    <img
      ref={ref}
      data-art
      src={`/art/${name}.webp`}
      srcSet={srcSet(name)}
      sizes={sizes}
      alt={alt}
      width={art[name].width}
      height={art[name].height}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ backgroundColor: art[name].color, ...style }}
    />
  )
}

export function Art({
  name,
  night,
  alt = '',
  sizes = '100vw',
  className,
  style,
}: {
  name: ArtName
  night?: ArtName
  alt?: string
  sizes?: string
  className?: string
  style?: CSSProperties
}) {
  const nightName = `${name}-night`
  const dark = night ?? (nightName in art ? (nightName as ArtName) : undefined)
  if (!dark) return <Painting name={name} alt={alt} sizes={sizes} className={className} style={style} />
  return (
    <>
      <Painting name={name} alt={alt} sizes={sizes} className={cn(className, 'dark:hidden')} style={style} />
      <Painting name={dark} alt={alt} sizes={sizes} className={cn(className, 'hidden dark:block')} style={style} />
    </>
  )
}
