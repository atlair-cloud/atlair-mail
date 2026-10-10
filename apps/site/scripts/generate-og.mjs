import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

import { alternatives } from '../app/seo/alternatives.ts'
import { useCases } from '../app/seo/use-cases.ts'

const root = new URL('../', import.meta.url)
const file = (path) => new URL(path, root)
const dataUrl = async (path, type) => `data:${type};base64,${(await readFile(file(path))).toString('base64')}`

const fonts = {
  serif: await dataUrl('node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', 'font/woff2'),
  italic: await dataUrl('node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2', 'font/woff2'),
  sans: await dataUrl('node_modules/@fontsource-variable/familjen-grotesk/files/familjen-grotesk-latin-wght-normal.woff2', 'font/woff2'),
  mono: await dataUrl('node_modules/@fontsource-variable/recursive/files/recursive-latin-mono-normal.woff2', 'font/woff2'),
}
const mark = await dataUrl('public/brand/atlair-mark.png', 'image/png')

const label = (a) => (a.slug === 'amazon-ses' ? 'Amazon SES' : a.name)
const cards = [
  { name: 'home', eyebrow: 'Open source · AGPL-3.0', title: 'Every email, accounted for.', art: 'cta-postbox', path: '' },
  { name: 'alternatives', eyebrow: 'Comparisons', title: 'Atlair Post, compared.', art: 'vignette-key', path: '/alternatives' },
  ...alternatives.map((a) => ({
    name: a.slug,
    eyebrow: 'Comparison',
    title: a.openSource ? `Atlair Post vs ${label(a)}.` : `An open-source alternative to ${label(a)}.`,
    art: 'vignette-key',
    path: `/alternatives/${a.slug}`,
  })),
  { name: 'use-cases', eyebrow: 'Use cases', title: 'The emails your product sends.', art: 'vignette-desk', path: '/use-cases' },
  ...useCases.map((u) => ({ name: u.slug, eyebrow: 'Use case', title: u.title, art: u.art, path: `/use-cases/${u.slug}` })),
]

function html(card, art) {
  const size = card.title.length > 36 ? 70 : 88
  return `<!doctype html><html><head><style>
    @font-face { font-family: OgSerif; src: url(${fonts.serif}); }
    @font-face { font-family: OgSerif; font-style: italic; src: url(${fonts.italic}); }
    @font-face { font-family: OgSans; src: url(${fonts.sans}); font-weight: 400 700; }
    @font-face { font-family: OgMono; src: url(${fonts.mono}); }
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; background: #faf8f2; color: #14243a; overflow: hidden; position: relative; }
    .air { position: absolute; inset: 0 0 auto 0; height: 10px; z-index: 2;
           background: repeating-linear-gradient(-45deg, #d9658f 0 14px, transparent 14px 22px, #1f7fb5 22px 36px, transparent 36px 44px); }
    .art { position: absolute; inset: 0 0 0 auto; width: 760px; height: 630px; object-fit: cover; object-position: right center; }
    .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #faf8f2 40%, rgba(250,248,242,.85) 52%, rgba(250,248,242,0) 74%); }
    .copy { position: absolute; inset: 70px auto 60px 72px; width: 620px; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: 12px; font: 600 30px OgSans; letter-spacing: -0.01em; }
    .brand img { width: 44px; height: 44px; }
    .brand i { font: italic 40px OgSerif; }
    .eyebrow { margin-top: auto; font: 20px OgMono; color: #4c5b70; font-variation-settings: "MONO" 1; }
    h1 { margin-top: 14px; font: ${size}px/1.0 OgSerif; letter-spacing: -0.01em; text-wrap: balance; }
    .url { margin-top: 28px; font: 20px OgMono; color: #4c5b70; font-variation-settings: "MONO" 1; }
  </style></head><body>
    <div class="air"></div>
    <img class="art" src="${art}"><div class="fade"></div>
    <div class="copy">
      <div class="brand"><img src="${mark}">Atlair <i>Post</i></div>
      <p class="eyebrow">${card.eyebrow}</p>
      <h1>${card.title}</h1>
      <p class="url">post.atlair.cloud${card.path}</p>
    </div>
  </body></html>`
}

await mkdir(file('public/og/'), { recursive: true })
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const card of cards) {
  await tab.setContent(html(card, await dataUrl(`public/art/${card.art}-1280.webp`, 'image/webp')), { waitUntil: 'load' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: file(`public/og/${card.name}.jpg`).pathname, type: 'jpeg', quality: 86 })
  console.log(`og/${card.name}.jpg`)
}
await browser.close()
