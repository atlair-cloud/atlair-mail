<script setup lang="ts">
import { Laptop, SmartphoneDevice, WarningCircle } from '@iconoir/vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { computed, ref } from 'vue'
import { ApiError } from '../../../lib/api/client'
import { previewDraft, type TemplateDocument, type TemplateTheme, type TemplateVariable, type VariableValues } from '../api/templates'
import { sampleValues } from '../lib/variables'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{
  organizationId: string
  subject: string
  content: TemplateDocument
  theme: TemplateTheme
  variables: TemplateVariable[]
  samples: VariableValues
}>()

const device = defineModel<'desktop' | 'mobile'>('device', { required: true })
const format = ref<'html' | 'text'>('html')

const input = computed(() => ({
  subject: props.subject.trim() || 'No subject',
  content: props.content,
  theme: props.theme,
  variables: props.variables,
  values: sampleValues(props.variables, props.samples),
}))
const debounced = refDebounced(input, 300)

const query = useQuery({
  queryKey: computed(() => ['organizations', props.organizationId, 'templates', 'preview', JSON.stringify(debounced.value)] as const),
  queryFn: () => previewDraft(props.organizationId, debounced.value, debounced.value.values),
  placeholderData: keepPreviousData,
  retry: false,
  staleTime: 60_000,
})

const problem = computed(() => {
  const error = query.error.value
  if (!error) return null
  if (error instanceof ApiError && error.status === 422) return error.message.replace(/^content\.content\[\d+\]/, 'A block')
  return 'The preview couldn’t be rendered. Try again in a moment.'
})
</script>

<template>
  <div class="flex min-h-[560px] flex-col overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <div class="min-w-0">
        <p class="m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Subject</p>
        <p class="m-0 mt-0.5 truncate text-sm font-medium text-slate-900">{{ query.data.value?.subject ?? input.subject }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="query.isFetching.value" class="font-mono text-[11px] text-slate-500" aria-live="polite">Rendering…</span>
        <SegmentedControl v-model="format" label="Format" :options="[{ value: 'html', label: 'HTML' }, { value: 'text', label: 'Text' }]" />
        <SegmentedControl
          v-if="format === 'html'"
          v-model="device"
          label="Device"
          icon-only
          :options="[{ value: 'desktop', label: 'Desktop', icon: Laptop }, { value: 'mobile', label: 'Phone', icon: SmartphoneDevice }]"
        />
      </div>
    </div>

    <div v-if="problem" role="alert" class="m-4 flex items-start gap-2.5 rounded-sm bg-red-50 px-3 py-2.5 ring-1 ring-red-200">
      <WarningCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-red-600" />
      <p class="m-0 text-sm text-red-800">{{ problem }}</p>
    </div>

    <div class="flex flex-1 justify-center overflow-auto p-4 sm:p-6">
      <div v-if="query.isPending.value" class="skeleton h-[520px] w-full max-w-[640px] rounded-sm" aria-busy="true" aria-label="Rendering the preview" />
      <template v-else-if="query.data.value">
        <pre
          v-if="format === 'text'"
          class="m-0 w-full max-w-[640px] whitespace-pre-wrap break-words rounded-sm bg-white p-5 font-mono text-[12.5px] leading-relaxed text-slate-800 ring-1 ring-slate-200"
        >{{ query.data.value.text || 'No text content.' }}</pre>
        <div
          v-else
          class="w-full overflow-hidden bg-white transition-[max-width] duration-300 motion-reduce:transition-none"
          :class="device === 'mobile' ? 'max-w-[390px] rounded-[28px] ring-[10px] ring-slate-800' : 'max-w-[760px] rounded-sm ring-1 ring-slate-200'"
        >
          <iframe
            title="Email preview"
            sandbox=""
            :srcdoc="query.data.value.html"
            class="block h-[640px] w-full border-0 bg-white transition-opacity motion-reduce:transition-none"
            :class="query.isFetching.value && 'opacity-70'"
          />
        </div>
      </template>
    </div>
  </div>
</template>
