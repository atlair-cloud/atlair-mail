<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    squareSize?: number
    gridGap?: number
    flickerChance?: number
    color?: string
    maxOpacity?: number
    fps?: number
  }>(),
  { squareSize: 2, gridGap: 6, flickerChance: 0.3, color: '#ffffff', maxOpacity: 0.25, fps: 24 },
)

const container = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

type Grid = { cols: number; rows: number; squares: Float32Array; dpr: number }

let grid: Grid | null = null
let frame = 0
let lastTick = 0
let resizeObserver: ResizeObserver | null = null
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function rgbPrefix(color: string) {
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const ctx = probe.getContext('2d')
  if (!ctx) return 'rgba(255, 255, 255,'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b},`
}

const prefix = computed(() => rgbPrefix(props.color))

function setup(el: HTMLCanvasElement, width: number, height: number): Grid {
  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  const step = props.squareSize + props.gridGap
  const cols = Math.ceil(width / step)
  const rows = Math.ceil(height / step)
  const squares = new Float32Array(cols * rows)
  for (let i = 0; i < squares.length; i++) squares[i] = Math.random() * props.maxOpacity
  return { cols, rows, squares, dpr }
}

function flicker(squares: Float32Array, seconds: number) {
  const chance = props.flickerChance * seconds
  for (let i = 0; i < squares.length; i++) {
    if (Math.random() < chance) squares[i] = Math.random() * props.maxOpacity
  }
}

function draw(ctx: CanvasRenderingContext2D, el: HTMLCanvasElement, { cols, rows, squares, dpr }: Grid) {
  ctx.clearRect(0, 0, el.width, el.height)
  const step = (props.squareSize + props.gridGap) * dpr
  const size = props.squareSize * dpr
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.fillStyle = `${prefix.value}${squares[i * rows + j]})`
      ctx.fillRect(i * step, j * step, size, size)
    }
  }
}

function tick(time: number) {
  frame = requestAnimationFrame(tick)
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx || !grid) return
  const elapsed = time - lastTick
  if (elapsed < 1000 / props.fps) return
  flicker(grid.squares, Math.min(elapsed, 1000) / 1000)
  draw(ctx, el, grid)
  lastTick = time
}

function start() {
  stop()
  if (reducedMotion.matches || document.hidden) return
  lastTick = performance.now()
  frame = requestAnimationFrame(tick)
}

function stop() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

function resize() {
  const el = canvas.value
  const box = container.value
  const ctx = el?.getContext('2d')
  if (!el || !box || !ctx) return
  grid = setup(el, box.clientWidth, box.clientHeight)
  draw(ctx, el, grid)
}

function onVisibility() {
  if (document.hidden) stop()
  else start()
}

watch(prefix, resize)

onMounted(() => {
  resize()
  resizeObserver = new ResizeObserver(resize)
  if (container.value) resizeObserver.observe(container.value)
  document.addEventListener('visibilitychange', onVisibility)
  reducedMotion.addEventListener('change', start)
  start()
})

onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
  reducedMotion.removeEventListener('change', start)
})
</script>

<template>
  <div ref="container" aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <canvas ref="canvas" class="block" />
  </div>
</template>
