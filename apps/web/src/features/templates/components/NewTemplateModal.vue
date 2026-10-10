<script setup lang="ts">
import { useRouter } from 'vue-router'
import FramedModal from '../../../components/shared/FramedModal.vue'
import type { StarterId } from '../lib/starters'
import StarterGallery from './StarterGallery.vue'

const props = defineProps<{ organizationId: string }>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()

function start(starter: StarterId) {
  open.value = false
  router.push({ name: 'template', params: { organizationId: props.organizationId, templateId: 'new' }, query: { starter } })
}
</script>

<template>
  <FramedModal v-model:open="open" title="New template" description="Pick a starting point. You can change everything in the editor." width="2xl">
    <StarterGallery @choose="start" />
    <template #footer>
      <button
        type="button"
        class="rounded-sm px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950"
        @click="open = false"
      >Cancel</button>
      <span class="px-2 text-xs text-slate-500">Nothing is saved until you save in the editor.</span>
    </template>
  </FramedModal>
</template>
