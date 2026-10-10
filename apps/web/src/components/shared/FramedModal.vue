<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    dismissible?: boolean
    width?: 'md' | 'xl' | '2xl' | '3xl'
  }>(),
  { description: undefined, dismissible: true, width: 'md' },
)
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
    :close="false"
    :dismissible="dismissible"
    :ui="{ content: `${width === '3xl' ? 'max-w-3xl' : width === '2xl' ? 'max-w-2xl' : width === 'xl' ? 'max-w-xl' : 'max-w-md'} rounded-lg bg-slate-100 p-1.5 ring-1 ring-slate-200 shadow-xl divide-y-0` }"
  >
    <template #content>
      <div class="rounded-md bg-white px-5 pb-5 pt-4 ring-1 ring-slate-200/80">
        <p aria-hidden="true" class="m-0 text-base font-semibold text-slate-900">{{ title }}</p>
        <p v-if="description" aria-hidden="true" class="mb-0 mt-2 text-sm leading-relaxed text-slate-600">{{ description }}</p>
        <div v-if="$slots.default" class="mt-4">
          <slot />
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 px-2 pb-0.5 pt-1.5">
        <slot name="footer" />
      </div>
    </template>
  </UModal>
</template>
