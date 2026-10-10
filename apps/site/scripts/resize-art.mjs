
import { readdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const DIR = new URL('../public/art/', import.meta.url)
const WIDTHS = [640, 1280, 1920]

const files = (await readdir(DIR)).filter((f) => f.endsWith('.webp') && !/-\d+\.webp$/.test(f)).sort()
const manifest = {}

for (const file of files) {
  const name = file.replace(/\.webp$/, '')
  const image = sharp(new URL(file, DIR).pathname)
  const { width, height } = await image.metadata()
  const { dominant } = await image.stats()
  const color = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

  const widths = WIDTHS.filter((w) => w < width)
  for (const w of widths) {
    await sharp(new URL(file, DIR).pathname).resize({ width: w }).webp({ quality: 78 }).toFile(new URL(`${name}-${w}.webp`, DIR).pathname)
  }
  manifest[name] = { width, height, color, widths }
  console.log(`${name}: ${[...widths, width].join(', ')} · ${color}`)
}

await writeFile(
  new URL('../app/art.generated.ts', import.meta.url),
  `export const art = ${JSON.stringify(manifest, null, 2)} as const;\n`,
)
