<script setup lang="ts">
import { useIsFetching } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const SHOW_AFTER_MS = 180
const router = useRouter()
const navigating = ref(false)
const firstLoads = useIsFetching({ predicate: (query) => query.state.status === 'pending' })
const busy = computed(() => navigating.value || firstLoads.value > 0)

const progress = ref(0)
const visible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | undefined
let trickleTimer: ReturnType<typeof setInterval> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

function start() {
  clearTimeout(hideTimer)
  if (visible.value || showTimer) return
  showTimer = setTimeout(() => {
    showTimer = undefined
    progress.value = 0.08
    visible.value = true
    trickleTimer = setInterval(() => {
      progress.value = Math.min(0.92, progress.value + (0.92 - progress.value) * 0.12)
    }, 250)
  }, SHOW_AFTER_MS)
}

function finish() {
  clearTimeout(showTimer)
  showTimer = undefined
  clearInterval(trickleTimer)
  if (!visible.value) return
  progress.value = 1
  hideTimer = setTimeout(() => {
    visible.value = false
    hideTimer = setTimeout(() => (progress.value = 0), 300)
  }, 250)
}

watch(busy, (value) => (value ? start() : finish()), { immediate: true })

const removeBefore = router.beforeEach((to, from) => {
  if (to.fullPath !== from.fullPath) navigating.value = true
})
const removeAfter = router.afterEach(() => (navigating.value = false))
const removeError = router.onError(() => (navigating.value = false))

onBeforeUnmount(() => {
  removeBefore()
  removeAfter()
  removeError()
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  clearInterval(trickleTimer)
})
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-x-3 top-0 z-30 h-5 overflow-hidden rounded-t-[10px] sm:inset-x-4">
    <div class="panel-progress-bar absolute inset-x-0 top-0 h-[2px] bg-atlair-950" :style="{ transform: `scaleX(${progress})`, opacity: visible ? 1 : 0 }">
      <div class="panel-progress-glint absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-canvas/70 to-transparent" />
    </div>
  </div>
  <span class="sr-only" role="status">{{ visible ? 'Loading' : '' }}</span>
</template>
