<script setup lang="ts">
import GridBackdrop from '../../../components/shared/GridBackdrop.vue'
import { logoUrl } from '../../../lib/brand'

defineProps<{ title: string; description: string }>()
</script>

<template>
  <main class="relative flex min-h-svh flex-col overflow-hidden bg-canvas px-6 text-atlair-950">
    <GridBackdrop />

    <div class="relative flex flex-1 items-center justify-center pb-[10vh] pt-16">
      <div class="w-full max-w-90">
        <div class="flex flex-col items-center text-center">
          <img class="size-10 object-contain [view-transition-name:brand-logo]" :src="logoUrl" alt="" width="40" height="40" />
          <h1 tabindex="-1" id="auth-title" class="m-0 mt-6 text-balance text-[26px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ title }}</h1>
          <p class="mb-0 mt-2 text-sm leading-relaxed text-slate-600">{{ description }}</p>
        </div>

        <slot />

        <div v-if="$slots.footer" class="mt-8 border-t border-slate-200/80 pt-6 text-center text-xs leading-relaxed text-slate-500 [view-transition-name:page-footer]">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </main>
</template>
