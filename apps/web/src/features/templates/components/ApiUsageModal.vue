<script setup lang="ts">
import { computed } from 'vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import CodeTabs from '../../developers/components/CodeTabs.vue'
import type { TemplateVariable } from '../api/templates'

const props = defineProps<{ reference: string; variables: TemplateVariable[]; publishedVersion: number | null }>()
const open = defineModel<boolean>('open', { required: true })

const call = computed(() => ({
  method: 'POST',
  path: '/emails',
  body: {
    from: 'Acme <hello@yourdomain.com>',
    to: ['ada@example.org'],
    template: {
      id: props.reference,
      variables: Object.fromEntries(props.variables.map((variable) => [variable.key, variable.type === 'number' ? 42 : `your ${variable.key.replace(/_/g, ' ')}`])),
    },
  },
}))
</script>

<template>
  <FramedModal v-model:open="open" title="Send it from your code" description="Use the template’s id or alias. Variables without a fallback are required." width="xl">
    <p v-if="publishedVersion === null" role="status" class="m-0 mb-3 rounded-sm bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
      Publish the template first. Until then, sends fail with <code class="font-mono text-xs">ATL_TEMPLATE_NOT_PUBLISHED</code>.
    </p>
    <CodeTabs :call="call" />
    <p class="m-0 mt-3 text-xs leading-relaxed text-slate-500">
      Sends with the live version<template v-if="publishedVersion !== null"> (v{{ publishedVersion }})</template>. Add <code class="font-mono">"version": 3</code> to the template to pin one.
    </p>
    <template #footer>
      <span />
      <button type="button" class="rounded-sm px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70" @click="open = false">Done</button>
    </template>
  </FramedModal>
</template>
