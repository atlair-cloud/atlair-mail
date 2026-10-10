<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ id?: string; disabled?: boolean }>()
</script>

<template>
  <USwitch
    :id="id"
    v-model="model"
    :disabled="disabled"
    :ui="{
      base: 'rounded-[5px] data-[state=unchecked]:bg-slate-200 data-[state=checked]:bg-atlair-950 focus-visible:outline-atlair-950',
      thumb: 'rounded-[3px] shadow-sm',
    }"
  />
</template>
