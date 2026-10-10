<script setup lang="ts">
withDefaults(defineProps<{ action: string; pending?: boolean; disabled?: boolean; cancelLabel?: string; form?: string }>(), { pending: false, disabled: false, cancelLabel: 'Cancel', form: undefined })
defineEmits<{ cancel: []; confirm: [] }>()
</script>

<template>
  <button
    type="button"
    :disabled="pending"
    class="rounded-sm px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 disabled:opacity-50"
    @click="$emit('cancel')"
  >
    {{ cancelLabel }}
  </button>
  <UButton
    :type="form ? 'submit' : 'button'"
    :form="form"
    size="lg"
    :loading="pending"
    :disabled="disabled"
    class="rounded-md bg-atlair-950 px-4 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:bg-atlair-950 disabled:opacity-40 aria-disabled:bg-atlair-950"
    @click="!form && $emit('confirm')"
  >
    {{ action }}
  </UButton>
</template>
