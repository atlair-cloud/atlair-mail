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
  'bento-templates': {
    size: '2048x1024',
    prompt: `A sunny wooden writing desk seen from slightly above. Along the left and right edges: a stack of cream letter
paper, an ink pot, a jar of pencils, a sprig of blossom in a glass, and a little line of string above with three blank
paper drafts pegged to it. The mascot floats at the right edge holding a small paintbrush, as if it just finished a letter.
The centre of the image is an empty, calm stretch of warm cream paper and soft haze with no objects, so a small card
can be placed on top of it.`,
  },
  'bento-webhooks': {
    size: '1024x1536',
    prompt: `A tall, narrow garden scene. At the bottom, a wooden porch step with a woven basket. Paper envelopes flutter
back down from the sky toward the basket like returning birds, each closed with a small pink wax seal. The mascot floats
near the top right, pressing a brass seal onto an envelope. Climbing roses frame the left and right edges. The middle of
the image is calm, soft sky blue and cream haze with no objects, so a narrow list can be placed on top of it.`,
  },
  'bento-domains': {
    size: '1536x1024',
    prompt: `A small cottage gate in a low stone wall, with a blank wooden name board hanging on the gate post and a little
brass lock. The mascot floats beside the board, proudly hanging it straight. Hydrangeas and leafy shrubs frame the left and
right edges. The centre is calm, open cream haze over a soft lawn with no objects, so a small card can be placed on top.`,
  },
  'bento-once': {
    size: '1536x1024',
    prompt: `A cosy front door with a brass letter slot and a woven doormat. A single sealed envelope rests neatly on the
doormat. The mascot floats nearby holding a second, identical envelope behind its back, gently deciding not to post it.
Potted flowers frame the left and right edges. The centre is calm cream haze with no objects, so a small card can be
placed on top.`,
  },
  'source-garden': {
    size: '2560x1280',
    prompt: `A wide garden scene at the open double doors of a small wooden workshop on the far left edge, warm light
inside showing neatly hung tools. On the far right edge, the mascot floats beside a round-topped pink postbox, waving
hello. Climbing roses, hydrangeas and soft trees frame both edges. A few paper envelopes drift lightly in the sky.
The whole centre (the middle 50 percent) is calm, open warm cream haze over a soft lawn with no objects at all, so a
large envelope can be placed on top of it.`,
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
  'bento-templates-night': {
    size: '2048x1024',
    night: 'bento-templates',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the writing desk, paper stack,
ink pot, pegged drafts and the mascot with its brush. A warm desk lamp glows; moonlight through a window. The centre stays
calm and dark with no objects so a small card can sit on top.`,
  },
  'bento-webhooks-night': {
    size: '1024x1536',
    night: 'bento-webhooks',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the porch step and basket, the
envelopes fluttering down with pink wax seals, the mascot pressing its seal, the roses on the edges. A porch lantern glows
warm and the envelopes catch the moonlight. The middle stays calm and dark with no objects so a list can sit on top.`,
  },
  'bento-domains-night': {
    size: '1536x1024',
    night: 'bento-domains',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the cottage gate, the blank name
board, the brass lock, the mascot and the hydrangeas. A small lantern on the gate post glows warm. The centre stays calm
and dark with no objects so a small card can sit on top.`,
  },
  'bento-once-night': {
    size: '1536x1024',
    night: 'bento-once',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the front door, brass letter slot,
doormat with one envelope, the mascot holding the second envelope behind its back, and the potted flowers. A porch light
glows warm. The centre stays calm and dark with no objects so a small card can sit on top.`,
  },
  'source-garden-night': {
    size: '2560x1280',
    night: 'source-garden',
    prompt: `Repaint the second reference image at night, keeping its exact composition: the open workshop on the left
with warm lamplight pouring out, the mascot waving beside the pink postbox on the right, the roses and hydrangeas, the
drifting envelopes catching moonlight. The whole centre stays calm and dark with no objects so a large envelope can sit
on top.`,
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
