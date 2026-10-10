<script setup lang="ts">
import { Key } from '@iconoir/vue'
import type { Actor } from '../../lib/api/actors'
import AvatarFace from './AvatarFace.vue'

withDefaults(defineProps<{ actor: Actor | null; fallback?: string }>(), { fallback: '—' })
</script>

<template>
  <span v-if="actor" class="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle" :title="actor.type === 'api_key' ? `API key “${actor.name}”` : actor.name">
    <span v-if="actor.type === 'user'" aria-hidden="true" class="flex size-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[8px] font-semibold text-slate-700">
      <AvatarFace :name="actor.name" />
    </span>
    <Key v-else aria-hidden="true" class="size-3.5 shrink-0 text-slate-500" />
    <span class="truncate"><span v-if="actor.type === 'api_key'" class="sr-only">API key </span>{{ actor.name }}</span>
  </span>
  <span v-else class="text-slate-500">{{ fallback }}</span>
</template>
