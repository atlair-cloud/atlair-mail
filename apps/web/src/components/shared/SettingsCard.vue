<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; tone?: 'default' | 'danger' }>(), { description: undefined, tone: 'default' })
</script>

<template>
  <section class="grid gap-x-12 gap-y-4 py-8 first:pt-0 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
    <div class="min-w-0">
      <h2 class="m-0 text-[15px] font-semibold" :class="tone === 'danger' ? 'text-red-700' : 'text-slate-900'">{{ title }}</h2>
      <p v-if="description || $slots.description" class="mb-0 mt-1 text-sm leading-relaxed text-slate-600"><slot name="description">{{ description }}</slot></p>
    </div>
    <div class="min-w-0 overflow-hidden rounded-md bg-white ring-1" :class="tone === 'danger' ? 'ring-red-200' : 'ring-slate-200'">
      <div v-if="$slots.default" class="px-5 py-5">
        <slot />
      </div>
      <footer
        v-if="$slots.footer"
        class="flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 py-3"
        :class="[tone === 'danger' ? 'bg-red-50/60' : 'bg-slate-50', $slots.default ? (tone === 'danger' ? 'border-t border-red-100' : 'border-t border-slate-100') : '']"
      >
        <slot name="footer" />
      </footer>
    </div>
  </section>
</template>
