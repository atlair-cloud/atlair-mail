<script setup lang="ts">
import { WarningCircle } from '@iconoir/vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import { ApiError } from '../../../lib/api/client'
import {
  getTemplateVersion,
  previewTemplate,
  publishTemplate,
  templateQueryKey,
  templateVersionQueryKey,
  type Template,
  type VariableValues,
} from '../api/templates'
import { sampleValues } from '../lib/variables'
import EmailFrame from './EmailFrame.vue'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{ organizationId: string; template: Template; samples: VariableValues }>()
const emit = defineEmits<{ published: [template: Template] }>()
const open = defineModel<boolean>('open', { required: true })

const note = ref('')
const side = ref<'next' | 'live'>('next')
const nextNumber = computed(() => props.template.latestVersion + 1)
const live = computed(() => props.template.publishedVersion)
const values = computed(() => sampleValues(props.template.variables, props.samples))

watch(open, (isOpen) => {
  if (!isOpen) return
  note.value = ''
  side.value = 'next'
  publish.reset()
})

const liveVersion = useQuery({
  queryKey: computed(() => templateVersionQueryKey(props.organizationId, props.template.id, live.value ?? 0)),
  queryFn: () => getTemplateVersion(props.organizationId, props.template.id, live.value!),
  enabled: computed(() => open.value && live.value !== null),
  staleTime: Infinity,
})

const preview = useQuery({
  queryKey: computed(() => [...templateQueryKey(props.organizationId, props.template.id), 'publish-preview', side.value, props.template.revision, JSON.stringify(values.value)] as const),
  queryFn: () => previewTemplate(props.organizationId, props.template.id, side.value === 'live' && live.value ? live.value : 'draft', values.value),
  enabled: open,
  staleTime: 60_000,
  retry: false,
})

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const changes = computed(() => {
  const before = liveVersion.data.value
  if (!before) return []
  const after = props.template
  return [
    { label: 'Subject', changed: before.subject !== after.subject },
    { label: 'Content', changed: !same(before.content, after.content) },
    { label: 'Style', changed: !same(before.theme, after.theme) },
    { label: 'Variables', changed: !same(before.variables, after.variables) },
  ].filter((change) => change.changed)
})

const publish = useMutation({
  mutationFn: () => publishTemplate(props.organizationId, props.template.id, props.template.revision, note.value),
  onSuccess(template) {
    emit('published', template)
    open.value = false
  },
})

const problem = computed(() => {
  const error = publish.error.value
  if (!error) return null
  if (error instanceof ApiError && error.code === 'ATL_TEMPLATE_CHANGED') return 'Someone saved the draft after you opened this. Close this and review their changes before publishing.'
  if (error instanceof ApiError) return error.message
  return 'Couldn’t publish. Check your connection and try again.'
})

const description = computed(() =>
  live.value === null
    ? 'Emails sent with this template start using it right away.'
    : `Replaces v${live.value} for every email sent from now on. Emails already sent don’t change.`,
)
</script>

<template>
  <FramedModal v-model:open="open" :title="`Publish v${nextNumber}`" :description="description" width="3xl">
    <div class="grid gap-4">
      <div v-if="live !== null" class="flex flex-wrap items-center justify-between gap-3">
        <p class="m-0 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <template v-if="liveVersion.isPending.value"><span class="skeleton h-5 w-40 rounded-sm" /></template>
          <template v-else-if="changes.length">
            <span>Changed since v{{ live }}</span>
            <span v-for="change in changes" :key="change.label" class="rounded-sm bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">{{ change.label }}</span>
          </template>
          <span v-else>Same design as v{{ live }}. Only the name or alias changed.</span>
        </p>
        <SegmentedControl
          v-model="side"
          label="Compare"
          :options="[{ value: 'live', label: `v${live} · Live` }, { value: 'next', label: `v${nextNumber} · New` }]"
          class="w-56"
        />
      </div>

      <div>
        <p class="m-0 mb-1.5 truncate text-xs text-slate-500">
          <span class="font-mono uppercase tracking-[0.12em]">Subject</span>
          <span class="ml-2 text-sm font-medium text-slate-900">{{ preview.data.value?.subject ?? '…' }}</span>
        </p>
        <p v-if="preview.isError.value" role="alert" class="m-0 flex items-start gap-2 rounded-sm bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          <WarningCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0" />{{ preview.error.value?.message }}
        </p>
        <EmailFrame v-else :html="preview.data.value?.html" :loading="preview.isFetching.value && !preview.data.value" :title="side === 'live' ? `Live version v${live}` : `New version v${nextNumber}`" :height="380" />
      </div>

      <form id="publish-form" novalidate @submit.prevent="publish.mutate()">
        <label for="publish-note" class="text-xs font-medium text-slate-700">What changed <span class="font-normal text-slate-500">(optional)</span></label>
        <input
          id="publish-note"
          v-model="note"
          type="text"
          maxlength="500"
          placeholder="Fixed the reset link"
          class="mt-1.5 h-9 w-full rounded-sm bg-white px-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-slate-400"
        />
      </form>

      <p v-if="problem" role="alert" class="m-0 flex items-start gap-2 rounded-sm bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
        <WarningCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0" />{{ problem }}
      </p>
    </div>
    <template #footer>
      <ModalActions :action="`Publish v${nextNumber}`" form="publish-form" :pending="publish.isPending.value" @cancel="open = false" />
    </template>
  </FramedModal>
</template>
