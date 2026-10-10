<script setup lang="ts">
import { logoUrl } from '../../lib/brand'

export type PuffMood = 'calm' | 'busy' | 'concerned' | 'happy' | 'lost'

defineProps<{ mood: PuffMood }>()
</script>

<template>
  <span aria-hidden="true" class="relative inline-flex size-12 shrink-0 items-center justify-center">
    <span v-if="mood === 'busy'" class="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-status-active/50 [animation-duration:6s] motion-reduce:animate-none" />
    <img
      :src="logoUrl"
      alt=""
      width="36"
      height="36"
      class="puff size-9 object-contain"
      :class="{ 'puff--calm': mood === 'calm', 'puff--busy': mood === 'busy', 'puff--concerned': mood === 'concerned', 'puff--happy': mood === 'happy', 'puff--lost': mood === 'lost' }"
    />
    <span v-if="mood === 'happy'" class="spark absolute -right-0.5 top-0 text-[11px] leading-none text-status-attention">✦</span>
    <span v-if="mood === 'lost'" class="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold leading-none text-slate-900 ring-2 ring-surface">?</span>
    <span v-if="mood === 'concerned'" class="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-status-attention text-[9px] font-bold leading-none text-atlair-950 ring-2 ring-surface">!</span>
  </span>
</template>

<style scoped>
.puff--calm {
  animation: puff-float 4.5s ease-in-out infinite;
}

.puff--busy {
  animation: puff-float 1.6s ease-in-out infinite;
}

.puff--concerned {
  transform: rotate(-8deg);
  transition: transform 300ms cubic-bezier(0.2, 0, 0, 1);
}

.puff--lost {
  animation: puff-look 3.2s ease-in-out infinite;
}

.puff--happy {
  animation: puff-hop 520ms cubic-bezier(0.3, 0.7, 0.4, 1.4) 2;
}

.spark {
  animation: spark 900ms ease-out both;
}

@keyframes puff-hop {
  40% {
    transform: translateY(-7px) rotate(-4deg);
  }
}

@keyframes spark {
  from {
    opacity: 0;
    transform: scale(0.4) rotate(-30deg);
  }
  40% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: scale(1.2) rotate(20deg) translateY(-4px);
  }
}

@keyframes puff-look {
  0%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-10deg);
  }
  65% {
    transform: rotate(8deg);
  }
}

@keyframes puff-float {
  50% {
    transform: translateY(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .puff,
  .spark {
    animation: none;
  }
}
</style>
