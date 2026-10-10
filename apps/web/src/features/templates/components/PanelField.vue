<script setup lang="ts">
defineProps<{ label: string; hint?: string; error?: string | null; for?: string }>()
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-2">
      <label :for="$props.for" class="block text-xs font-medium text-slate-700">{{ label }}</label>
      <slot name="aside" />
    </div>
    <div class="mt-1.5"><slot /></div>
    <p v-if="error" role="alert" class="m-0 mt-1 text-xs text-red-600">{{ error }}</p>
    <p v-else-if="hint" class="m-0 mt-1 text-xs leading-relaxed text-slate-500">{{ hint }}</p>
  </div>
</template>
