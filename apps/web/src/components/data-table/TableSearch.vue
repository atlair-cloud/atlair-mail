<script setup lang="ts">
import { Search, Xmark } from '@iconoir/vue'
import { useDebounceFn } from '@vueuse/core'
import { ref, watch } from 'vue'

defineProps<{ label: string; placeholder?: string }>()

const model = defineModel<string>({ default: '' })
const draft = ref(model.value)

const commit = useDebounceFn((value: string) => {
  model.value = value.trim()
}, 250)

watch(model, (value) => {
  if (value !== draft.value.trim()) draft.value = value
})
watch(draft, (value) => commit(value))

function clear() {
  draft.value = ''
  model.value = ''
}
</script>

<template>
  <UInput
    v-model="draft"
    type="search"
    size="sm"
    :aria-label="label"
    :placeholder="placeholder ?? label"
    autocomplete="off"
    spellcheck="false"
    class="w-full"
    :ui="{ base: 'h-8 rounded-sm bg-white pl-8 pr-8 text-sm [&::-webkit-search-cancel-button]:hidden' }"
    @keydown.esc="clear"
  >
    <template #leading><Search aria-hidden="true" class="size-3.5 text-slate-400" /></template>
    <template v-if="draft" #trailing>
      <button type="button" aria-label="Clear search" class="flex size-5 items-center justify-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700" @click="clear">
        <Xmark aria-hidden="true" class="size-3.5" />
      </button>
    </template>
  </UInput>
</template>
