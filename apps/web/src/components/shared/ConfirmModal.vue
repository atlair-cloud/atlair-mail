<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FramedModal from './FramedModal.vue'

const props = defineProps<{
  title: string
  description: string
  action: string
  pending?: boolean
  error?: string
  confirmText?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()

const typed = ref('')
const unlocked = computed(() => !props.confirmText || typed.value.trim() === props.confirmText)

watch(open, (isOpen) => {
  if (isOpen) typed.value = ''
})

function submit() {
  if (unlocked.value && !props.pending) emit('confirm')
}
</script>

<template>
  <FramedModal v-model:open="open" :title="title" :description="description" :dismissible="!pending">
    <form v-if="confirmText || error" id="confirm-form" novalidate @submit.prevent="submit">
      <template v-if="confirmText">
        <label for="confirm-text" class="block text-xs font-medium text-slate-700">Type <span class="font-semibold text-slate-900">{{ confirmText }}</span> to confirm</label>
        <UInput
          id="confirm-text"
          v-model="typed"
          size="lg"
          autofocus
          autocomplete="off"
          spellcheck="false"
          :disabled="pending"
          class="mt-2 w-full"
          :ui="{ base: 'h-10 rounded-sm bg-white text-sm text-slate-900' }"
        />
      </template>
      <p v-if="error" role="alert" class="mb-0 mt-3 text-xs leading-relaxed text-red-600">{{ error }}</p>
    </form>

    <template #footer>
      <button
        type="button"
        :disabled="pending"
        class="rounded-sm px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 disabled:opacity-50"
        @click="open = false"
      >
        Cancel
      </button>
      <UButton
        type="button"
        size="lg"
        :loading="pending"
        :disabled="!unlocked"
        class="rounded-md bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:bg-red-600 disabled:opacity-40 aria-disabled:bg-red-600"
        @click="submit"
      >
        {{ action }}
      </UButton>
    </template>
  </FramedModal>
</template>
