import { mkdir, readFile, writeFile } from 'node:fs/promises'

const MODEL = 'gpt-image-2.5-sunburst'
const OUT = new URL('../public/art/', import.meta.url)
const MASCOT = new URL('../public/brand/atlair-mascot.png', import.meta.url)

const STYLE = `
Art direction: a hand-painted gouache and watercolour background painting, in the tradition of classic
hand-painted animation backgrounds. Soft morning light, lush layered greenery, gentle depth haze,
visible but delicate brushwork. Palette: warm cream (#faf8f2) sky and haze, fresh leaf greens,
soft sky blue (#5eb7e6), a little blossom pink (#f08eb6) and warm wood tones. Calm, warm, homely.
No text, no letters of the alphabet, no logos, no user interface, no people.
`

const NIGHT_STYLE = `
Art direction: the same hand-painted gouache and watercolour style, repainted as a calm, clear night.
Deep blue-charcoal sky (#101214 at the darkest), moonlight on the greenery, soft warm lantern and window
glow (#f4c96b), a few quiet stars. The mascot keeps its sky blue and pink colours, gently lit.
No text, no letters of the alphabet, no logos, no user interface, no people.
`

const MASCOT_NOTE = `
The reference image is Atlair's mascot: a small round cloud creature, sky blue with a pink blush on its
lower half, two large glossy oval eyes and no mouth. Paint it in the same painterly style as the scene but
keep its exact shape, colours and eyes. It is small in the frame and gentle.
`

const scenes = {
  'hero-post': {
    size: '2560x1440',
    prompt: `Wide panoramic landscape used behind a website hero. The left and right edges are framed by leafy trees,
flowering hydrangeas and wildflowers. On a small hill on the far right stands a tiny cosy village post office cottage
with a warm lit window and a round-topped pink postbox by its gate. The mascot floats beside the postbox holding a
small sealed envelope. A few folded paper envelopes drift across the sky toward the cottage like birds.
The centre is an open, softly lit meadow fading into warm cream haze so a product window can sit on top of it.
The top half is almost empty pale cream sky. Keep the centre calm and uncluttered.`,
  },
  'hero-post-night': {
    size: '2560x1440',
    night: 'hero-post',
    prompt: `Repaint the second reference image, the same wide landscape, at night. Keep the exact composition: trees and
hydrangeas framing the edges, the open meadow in the centre, the post office cottage and pink postbox on the right hill
with the mascot holding its envelope. The cottage window glows warm. The drifting envelopes catch the moonlight.
The centre and top half stay calm and dark so a product window can sit on top.`,
  },
  'cta-postbox': {
    size: '2048x1152',
    prompt: `A garden path in late morning. On the right side, a wooden garden gate in a low stone wall with climbing roses,
and beside it a round-topped pink postbox on a post. The mascot floats in front of the postbox, gently posting a sealed
envelope into its slot. Bright deep sky blue sky with soft clouds behind. The left 45 percent of the image is calm,
deep sky blue sky with soft painterly clouds and no objects, so white headline text can be placed there.`,
  },
  'cta-postbox-night': {
    size: '2048x1152',
    night: 'cta-postbox',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the garden gate and roses on the
right, the pink postbox, the mascot posting its envelope. A small lantern on the gate post glows warm. The left 45 percent
stays calm, deep midnight-blue sky with no objects so white headline text can sit there.`,
  },
  'vignette-key': {
    size: '1536x864',
    prompt: `A tiny village post office cottage in a garden, its front door painted sky blue. The mascot floats at the door,
turning a large brass key in the lock, as if it is the owner opening up in the morning. Potted flowers by the step,
a pink postbox by the door. Centred composition with soft cream haze around the edges.`,
  },
  'vignette-desk': {
    size: '1536x864',
    prompt: `A wooden writing desk by a sunny window: cream letter paper, an ink pot, a few postage stamps with tiny painted
flowers, a stick of pink sealing wax and a brass seal. The mascot floats over the paper holding a small quill, writing.
Centred composition with soft cream haze around the edges.`,
  },
  'vignette-bell': {
    size: '1536x864',
    prompt: `A garden gate with a small brass bell hanging from its post, and a woven basket on the ground catching paper
envelopes that drift down from the sky. The mascot floats beside the bell, ringing it gently to say a letter has arrived.
Centred composition with soft cream haze around the edges.`,
  },
  'open-door': {
    size: '1536x864',
    prompt: `A cosy workshop shed in a garden with its double doors wide open, showing neatly hung tools, labelled wooden
drawers and a workbench with a half-assembled wooden postbox. Morning light pours in. The mascot floats in the doorway,
welcoming the viewer inside. Centred composition with soft cream haze around the edges.`,
  },
  'vignette-key-night': {
    size: '1536x864',
    night: 'vignette-key',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the post office cottage with its
sky blue door, the mascot turning the brass key, the pink postbox and potted flowers. The lantern by the door glows warm and
the window glows softly. Soft dark haze around the edges.`,
  },
  'vignette-desk-night': {
    size: '1536x864',
    night: 'vignette-desk',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the writing desk, letter paper,
ink pot, stamps, pink sealing wax and brass seal, and the mascot holding its quill. A small warm candle or desk lamp lights
the paper; moonlight through the window. Soft dark haze around the edges.`,
  },
  'vignette-bell-night': {
    size: '1536x864',
    night: 'vignette-bell',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the garden gate, the brass bell,
the basket catching envelopes and the mascot ringing the bell. A small lantern on the gate post glows warm; the drifting
envelopes catch the moonlight. Soft dark haze around the edges.`,
  },
  'open-door-night': {
    size: '1536x864',
    night: 'open-door',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the workshop shed with doors wide
open, the hung tools, drawers and workbench with the wooden postbox, and the mascot in the doorway. Warm lamplight pours out
of the shed onto the moonlit garden. Soft dark haze around the edges.`,
  },
}

async function generate(name) {
  const scene = scenes[name]
  if (!scene) throw new Error(`Unknown scene: ${name}`)
  const form = new FormData()
  form.set('model', MODEL)
  form.set('prompt', `${scene.prompt}\n${scene.night ? NIGHT_STYLE : STYLE}\n${MASCOT_NOTE}`)
  form.set('size', scene.size)
  form.set('quality', 'high')
  form.set('output_format', 'webp')
  form.set('output_compression', '82')
  form.append('image[]', new Blob([await readFile(MASCOT)], { type: 'image/png' }), 'atlair-mascot.png')
  if (scene.night) {
    const day = await readFile(new URL(`${scene.night}.webp`, OUT))
    form.append('image[]', new Blob([day], { type: 'image/webp' }), `${scene.night}.webp`)
  }
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(body.error ?? body)}`)
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL(`${name}.webp`, OUT), Buffer.from(body.data[0].b64_json, 'base64'))
  console.log(`${name}: done`)
}

if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY')
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(scenes)
const results = await Promise.allSettled(names.map(generate))
for (const r of results) if (r.status === 'rejected') console.error(r.reason.message)
if (results.some((r) => r.status === 'rejected')) process.exit(1)
