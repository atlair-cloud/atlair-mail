<script setup lang="ts">
import { Xmark, WarningCircle } from '@iconoir/vue'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import ActorName from '../../../components/shared/ActorName.vue'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import { ApiError } from '../../../lib/api/client'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import {
  listTemplateVersions,
  previewTemplate,
  restoreTemplateVersion,
  rollbackTemplateVersion,
  templateVersionsQueryKey,
  type Template,
  type TemplateVersionSummary,
  type VariableValues,
} from '../api/templates'
import { sampleValues } from '../lib/variables'
import EmailFrame from './EmailFrame.vue'

const props = defineProps<{ organizationId: string; template: Template; canManage: boolean; dirty: boolean; samples: VariableValues; focus?: number | null }>()
const emit = defineEmits<{ changed: [template: Template, message: string] }>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()
const now = useNow({ interval: 30_000 })
const selected = ref<number | null>(null)
const confirming = ref<'restore' | 'rollback' | null>(null)

watch(open, (isOpen) => {
  if (isOpen) selected.value = props.focus ?? props.template.publishedVersion
})

const versions = useInfiniteQuery({
  queryKey: computed(() => templateVersionsQueryKey(props.organizationId, props.template.id)),
  queryFn: ({ pageParam }) => listTemplateVersions(props.organizationId, props.template.id, pageParam),
  initialPageParam: undefined as number | undefined,
  getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.data.at(-1)?.number : undefined),
  enabled: open,
})
const rows = computed(() => versions.data.value?.pages.flatMap((page) => page.data) ?? [])
const current = computed(() => rows.value.find((row) => row.number === selected.value) ?? null)

const values = computed(() => sampleValues(props.template.variables, props.samples))
const preview = useQuery({
  queryKey: computed(() => [...templateVersionsQueryKey(props.organizationId, props.template.id), selected.value, 'preview', JSON.stringify(values.value)] as const),
  queryFn: () => previewTemplate(props.organizationId, props.template.id, selected.value!, values.value),
  enabled: computed(() => open.value && selected.value !== null),
  staleTime: Infinity,
  retry: false,
})

function select(row: TemplateVersionSummary) {
  selected.value = selected.value === row.number ? null : row.number
}

const act = useMutation({
  mutationFn: (kind: 'restore' | 'rollback') =>
    kind === 'restore'
      ? restoreTemplateVersion(props.organizationId, props.template.id, selected.value!, props.template.revision)
      : rollbackTemplateVersion(props.organizationId, props.template.id, selected.value!, props.template.revision, ''),
  async onSuccess(template, kind) {
    const number = selected.value
    confirming.value = null
    await queryClient.invalidateQueries({ queryKey: templateVersionsQueryKey(props.organizationId, props.template.id) })
    emit('changed', template, kind === 'restore' ? `v${number} is in the draft. Publish it when you’re ready.` : `v${number} is live again as v${template.publishedVersion}.`)
    if (kind === 'rollback') selected.value = template.publishedVersion
    else open.value = false
  },
})

const actError = computed(() => {
  const error = act.error.value
  if (!error) return undefined
  if (error instanceof ApiError && error.code === 'ATL_TEMPLATE_CHANGED') return 'Someone saved the draft a moment ago. Close this, check their changes, then try again.'
  return error instanceof ApiError ? error.message : 'Couldn’t reach Atlair Mail. Try again.'
})

watch(confirming, () => act.reset())

const draftWarning = computed(() => (props.template.hasUnpublishedChanges ? ' The draft’s unpublished changes are replaced.' : ''))

const confirmCopy = computed(() =>
  confirming.value === 'rollback'
    ? {
        title: `Roll back to v${selected.value}?`,
        description: `v${selected.value} goes live right away as v${props.template.latestVersion + 1}. Emails already sent don’t change.${draftWarning.value}`,
        action: `Roll back to v${selected.value}`,
      }
    : {
        title: `Restore v${selected.value} to the draft?`,
        description: `Emails keep using v${props.template.publishedVersion} until you publish.${draftWarning.value}`,
        action: 'Restore to draft',
      },
)

const confirmOpen = computed({
  get: () => confirming.value !== null,
  set: (value: boolean) => {
    if (!value) confirming.value = null
  },
})

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <USlideover v-model:open="open" title="Version history" description="Every published version of this template." side="right" :close="false" :ui="{ content: 'max-w-md w-full bg-white' }">
    <template #content>
      <div class="flex h-full min-h-0 flex-col">
        <header class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
          <div class="min-w-0">
            <p aria-hidden="true" class="m-0 text-base font-semibold text-slate-900">Version history</p>
            <p class="m-0 mt-1 text-sm text-slate-600">Emails send with the live version. Publishing adds a new one; nothing is overwritten.</p>
          </div>
          <button type="button" class="flex size-8 shrink-0 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950" aria-label="Close version history" @click="open = false">
            <Xmark aria-hidden="true" class="size-4" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
          <div v-if="versions.isPending.value" class="grid gap-2 px-2" aria-busy="true" aria-label="Loading versions">
            <div v-for="index in 4" :key="index" class="skeleton h-14 rounded-sm" />
          </div>
          <p v-else-if="versions.isError.value" role="alert" class="m-2 flex items-start gap-2 rounded-sm bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
            <WarningCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0" />Couldn’t load the versions.
            <button type="button" class="ml-auto font-medium underline" @click="versions.refetch()">Try again</button>
          </p>
          <div v-else-if="rows.length === 0" class="px-4 py-12 text-center">
            <p class="m-0 text-sm font-medium text-slate-900">Not published yet</p>
            <p class="m-0 mt-1 text-sm text-slate-500">Publish the draft to create v1. Each publish is kept here.</p>
          </div>
          <ol v-else class="m-0 grid list-none gap-1 p-0">
            <li v-for="row in rows" :key="row.id">
              <button
                type="button"
                class="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-3 rounded-sm px-2 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
                :class="selected === row.number ? 'bg-slate-100' : 'hover:bg-slate-50'"
                :aria-expanded="selected === row.number"
                @click="select(row)"
              >
                <span class="mt-px font-mono text-[13px] font-semibold tabular-nums text-slate-900">v{{ row.number }}</span>
                <span class="min-w-0">
                  <span class="block truncate text-sm" :class="row.note ? 'text-slate-900' : 'text-slate-500'">{{ row.note ?? row.subject }}</span>
                  <span class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-500">
                    <ActorName :actor="row.publishedBy" fallback="Someone" class="min-w-0" />
                    <span aria-hidden="true">·</span>
                    <time :datetime="row.publishedAt" :title="absolute.format(new Date(row.publishedAt))" class="shrink-0">{{ formatRelativeTime(row.publishedAt, now.getTime()) }}</time>
                  </span>
                </span>
                <span v-if="row.isPublished" class="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                  <span aria-hidden="true" class="size-1.5 rounded-full bg-status-live" />Live
                </span>
              </button>

              <div v-if="selected === row.number" class="grid gap-3 px-2 pb-4 pt-2">
                <p class="m-0 truncate text-xs text-slate-500">
                  <span class="font-mono uppercase tracking-[0.12em]">Subject</span>
                  <span class="ml-2 text-sm font-medium text-slate-900">{{ preview.data.value?.subject ?? row.subject }}</span>
                </p>
                <p v-if="preview.isError.value" role="alert" class="m-0 text-sm text-red-700">{{ preview.error.value?.message }}</p>
                <EmailFrame v-else :html="preview.data.value?.html" :loading="preview.isPending.value" :title="`Version ${row.number}`" :height="320" />
                <div v-if="canManage" class="flex flex-wrap items-center gap-2">
                  <UButton
                    type="button"
                    color="neutral"
                    variant="outline"
                    size="md"
                    :disabled="dirty"
                    class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100"
                    @click="confirming = 'restore'"
                  >Restore to draft</UButton>
                  <UButton
                    v-if="!row.isPublished"
                    type="button"
                    size="md"
                    :disabled="dirty"
                    class="h-8 rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900 disabled:opacity-40"
                    @click="confirming = 'rollback'"
                  >Roll back to v{{ row.number }}</UButton>
                  <p v-if="dirty" class="m-0 basis-full text-xs text-amber-700">Save or discard your changes first.</p>
                </div>
              </div>
            </li>
          </ol>
          <div v-if="versions.hasNextPage.value" class="px-2 pt-2">
            <button type="button" class="h-8 w-full rounded-sm text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50" :disabled="versions.isFetchingNextPage.value" @click="versions.fetchNextPage()">
              {{ versions.isFetchingNextPage.value ? 'Loading…' : `Show older than v${rows.at(-1)?.number}` }}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        v-if="current"
        v-model:open="confirmOpen"
        :title="confirmCopy.title"
        :description="confirmCopy.description"
        :action="confirmCopy.action"
        :pending="act.isPending.value"
        :error="actError"
        @confirm="act.mutate(confirming!)"
      />
    </template>
  </USlideover>
</template>
