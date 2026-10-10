<script setup lang="ts">
import { Xmark } from '@iconoir/vue'
import PuffMood from '../../../components/shared/PuffMood.vue'

defineEmits<{ dismiss: [] }>()
</script>

<template>
  <section role="status" class="flex items-start gap-4 rounded-md bg-emerald-50 px-5 py-4 ring-1 ring-emerald-200 [--surface:var(--color-emerald-50)]">
    <PuffMood mood="happy" />
    <div class="min-w-0 flex-1">
      <p class="m-0 text-base font-semibold text-slate-900">You’re sending</p>
      <p class="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
        Your first email is on its way. From now on this page shows how sending is going: volume, delivery and bounce rates, and anything that needs you.
      </p>
    </div>
    <button type="button" class="rounded-sm p-1 text-slate-500 hover:bg-white/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950" aria-label="Dismiss" @click="$emit('dismiss')">
      <Xmark aria-hidden="true" class="size-4" />
    </button>
  </section>
</template>
