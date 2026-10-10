<script setup lang="ts">
import { ClockRotateRight, Code, Copy, EditPencil, Eye, MoreHoriz, NavArrowLeft, SendDiagonal, Trash, WarningCircle } from '@iconoir/vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/composables'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useClipboard, useEventListener } from '@vueuse/core'
import { NodeSelection } from '@tiptap/pm/state'
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import { ApiError } from '../../../lib/api/client'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  templatesQueryKey,
  templateVersionsQueryKey,
  updateTemplate,
  type Template,
  type TemplateDraft,
  type TemplateTheme,
  type TemplateVariable,
  type VariableValues,
} from '../api/templates'
import { useTemplateEditor } from '../editor/useTemplateEditor'
import { resolveTheme } from '../lib/theme'
import { describeTemplateError } from '../lib/errors'
import { lintTemplate, previewableContent } from '../lib/lint'
import { countVariables, undeclaredVariables } from '../lib/variables'
import ApiUsageModal from './ApiUsageModal.vue'
import BlockPanel from './BlockPanel.vue'
import PublishModal from './PublishModal.vue'
import ReleaseStatus from './ReleaseStatus.vue'
import SegmentedControl from './SegmentedControl.vue'
import SendTestModal from './SendTestModal.vue'
import StylePanel from './StylePanel.vue'
import TemplateCanvas from './TemplateCanvas.vue'
import TemplatePreview from './TemplatePreview.vue'
import VariablesPanel from './VariablesPanel.vue'
import VersionHistory from './VersionHistory.vue'

const props = defineProps<{ organizationId: string; template: Template | null; initial: TemplateDraft; canManage: boolean }>()
const emit = defineEmits<{ created: [id: string] }>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()
const { copy } = useClipboard({ legacy: true })

const toDraft = (template: Template): TemplateDraft => ({
  name: template.name,
  alias: template.alias,
  subject: template.subject,
  content: template.content,
  theme: template.theme,
  variables: template.variables,
})

const serialize = (draft: TemplateDraft) => JSON.stringify(draft)

const draft = ref<TemplateDraft>(JSON.parse(JSON.stringify(props.initial)))
const saved = ref<Template | null>(props.template)
const snapshot = ref(props.template ? serialize(toDraft(props.template)) : serialize(props.initial))
const dirty = computed(() => serialize(draft.value) !== snapshot.value)
const isNew = computed(() => !saved.value)
const readonly = computed(() => !props.canManage)

const mode = ref<'edit' | 'preview'>('edit')
const device = ref<'desktop' | 'mobile'>('desktop')
const tab = ref<'block' | 'style' | 'variables'>('block')
const samples = ref<VariableValues>({})

const counts = computed(() => countVariables(draft.value.subject, draft.value.content))
const undeclared = computed(() => undeclaredVariables(counts.value, draft.value.variables))
const effectiveVariables = computed<TemplateVariable[]>(() => [...draft.value.variables, ...undeclared.value.map((key) => ({ key, type: 'string' as const }))])
const theme = computed(() => resolveTheme(draft.value.theme))

const { editor, revision, replace } = useTemplateEditor({
  content: draft.value.content,
  editable: computed(() => props.canManage),
  declared: () => draft.value.variables.map((variable) => variable.key),
  onChange: (content) => {
    draft.value.content = content
  },
  onCreateVariable: (key) => {
    if (!draft.value.variables.some((variable) => variable.key === key)) draft.value.variables = [...draft.value.variables, { key, type: 'string' }]
  },
})

watch(revision, () => {
  const selection = editor.value?.state.selection
  if (selection instanceof NodeSelection && selection.node.type.name !== 'variable' && tab.value !== 'block') tab.value = 'block'
})

const themeModel = computed({
  get: () => draft.value.theme,
  set: (value: TemplateTheme) => {
    draft.value.theme = value
  },
})

const variablesModel = computed({
  get: () => draft.value.variables,
  set: (value: TemplateVariable[]) => {
    draft.value.variables = value
  },
})

function insertVariable(key: string) {
  editor.value?.chain().focus().insertVariable(key).run()
}

const nameError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const conflict = ref<number | null>(null)

function payload(): TemplateDraft {
  return { ...draft.value, name: draft.value.name.trim() || 'Untitled template', subject: draft.value.subject, variables: effectiveVariables.value }
}

function accept(template: Template) {
  saved.value = template
  draft.value = { ...draft.value, name: template.name, alias: template.alias, variables: template.variables }
  snapshot.value = serialize(toDraft(template))
  if (serialize(draft.value) !== snapshot.value) draft.value = toDraft(template)
  conflict.value = null
  saveError.value = null
  nameError.value = null
  queryClient.invalidateQueries({ queryKey: templatesQueryKey(props.organizationId) })
}

const save = useMutation({
  mutationFn: async (options: { overwrite?: boolean } = {}) => {
    const body = payload()
    if (!saved.value) return createTemplate(props.organizationId, body)
    let expected = saved.value.revision
    if (options.overwrite) expected = (await getTemplate(props.organizationId, saved.value.id)).revision
    return updateTemplate(props.organizationId, saved.value.id, expected, body)
  },
  onSuccess(template) {
    const created = !saved.value
    accept(template)
    if (created) {
      emit('created', template.id)
      router.replace({ name: 'template', params: { organizationId: props.organizationId, templateId: template.id } })
      toast.add({ title: 'Template created', description: 'Send it with its id, or give it an alias.', color: 'neutral' })
    }
  },
  onError(error) {
    if (!(error instanceof ApiError)) {
      saveError.value = 'Couldn’t save. Check your connection and try again.'
      return
    }
    if (error.code === 'ATL_TEMPLATE_CHANGED') {
      conflict.value = Number(/revision (\d+)/.exec(error.message)?.[1] ?? 0) || null
      return
    }
    if (error.code === 'ATL_TEMPLATE_TAKEN') {
      nameError.value = /alias/.test(error.message) ? 'Another template already uses this alias' : 'Another template already has this name'
      return
    }
    saveError.value = error.code === 'ATL_TEMPLATE_INVALID' ? describeTemplateError(error.message, draft.value) : error.message
  },
})

const previewContent = computed(() => previewableContent(draft.value.content))

const issues = computed(() => (revision.value, lintTemplate(draft.value.subject, editor.value?.state.doc ?? null)))
const showIssues = ref(false)

watch(issues, (current) => {
  if (current.length === 0) showIssues.value = false
})

function goToIssue(pos: number | null) {
  mode.value = 'edit'
  if (pos === null) {
    document.getElementById('template-subject')?.focus()
    return
  }
  tab.value = 'block'
  editor.value?.chain().setNodeSelection(pos).scrollIntoView().focus().run()
}

function trySave() {
  if (readonly.value || save.isPending.value) return
  if (!dirty.value && !isNew.value) return
  saveError.value = null
  if (issues.value.length > 0) {
    showIssues.value = true
    goToIssue(issues.value[0]!.pos)
    return
  }
  save.mutate({})
}

function load(template: Template) {
  draft.value = toDraft(template)
  replace(template.content)
  accept(template)
}

async function loadTheirs() {
  if (!saved.value) return
  load(await getTemplate(props.organizationId, saved.value.id))
}

const publishing = ref(false)
const historyOpen = ref(false)
const historyFocus = ref<number | null>(null)
const hasSomethingToPublish = computed(() => dirty.value || Boolean(saved.value?.hasUnpublishedChanges))

async function startPublish() {
  if (readonly.value || !saved.value || save.isPending.value) return
  if (dirty.value) {
    saveError.value = null
    if (issues.value.length > 0) {
      showIssues.value = true
      goToIssue(issues.value[0]!.pos)
      return
    }
    try {
      await save.mutateAsync({})
    } catch {
      return
    }
  }
  if (saved.value.hasUnpublishedChanges) publishing.value = true
}

function onPublished(template: Template) {
  accept(template)
  queryClient.invalidateQueries({ queryKey: templateVersionsQueryKey(props.organizationId, template.id) })
  toast.add({ title: `v${template.publishedVersion} is live`, description: 'Emails sent from now on use this version.', color: 'neutral' })
}

function onHistoryChanged(template: Template, message: string) {
  load(template)
  toast.add({ title: message, color: 'neutral' })
}

function openHistory(focus: number | null = null) {
  historyFocus.value = focus
  historyOpen.value = true
}

const linkedVersion = Number(route.query.history)
if (props.template && Number.isInteger(linkedVersion) && linkedVersion > 0) openHistory(linkedVersion)

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    trySave()
  }
})

useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty.value) event.preventDefault()
})

const leaving = ref(false)
let resolveLeave: ((leave: boolean) => void) | null = null

onBeforeRouteLeave((to) => {
  if (!dirty.value || save.isPending.value) return true
  if (to.name === 'template' && to.params.templateId === saved.value?.id) return true
  leaving.value = true
  return new Promise<boolean>((resolve) => {
    resolveLeave = resolve
  })
})

function settleLeave(leave: boolean) {
  leaving.value = false
  resolveLeave?.(leave)
  resolveLeave = null
}

watch(leaving, (open) => {
  if (!open && resolveLeave) settleLeave(false)
})

const sending = ref(false)
const showApi = ref(false)
const editingAlias = ref(false)
const aliasDraft = ref('')
const aliasError = ref<string | null>(null)
const deleting = ref(false)

function openAlias() {
  aliasDraft.value = draft.value.alias ?? ''
  aliasError.value = null
  editingAlias.value = true
}

function applyAlias() {
  const value = aliasDraft.value.trim().toLowerCase()
  if (value && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value)) {
    aliasError.value = 'Lowercase letters, numbers and dashes, starting with a letter or number'
    return
  }
  draft.value.alias = value || null
  editingAlias.value = false
  nameError.value = null
}

const remove = useMutation({
  mutationFn: () => deleteTemplate(props.organizationId, saved.value!.id),
  async onSuccess() {
    snapshot.value = serialize(draft.value)
    await queryClient.invalidateQueries({ queryKey: templatesQueryKey(props.organizationId) })
    deleting.value = false
    toast.add({ title: 'Template deleted', description: 'Emails already sent with it keep their content.', color: 'neutral' })
    router.push({ name: 'templates', params: { organizationId: props.organizationId } })
  },
})

const menu = computed<DropdownMenuItem[][]>(() => {
  const groups: DropdownMenuItem[][] = []
  if (saved.value) {
    const template = saved.value
    groups.push([
      { label: 'Version history', icon: ClockRotateRight, onSelect: () => openHistory() },
      { label: 'Send from your code', icon: Code, onSelect: () => (showApi.value = true) },
      {
        label: 'Copy template ID',
        icon: Copy,
        onSelect: () => {
          copy(template.id)
          toast.add({ title: 'Template ID copied', color: 'neutral' })
        },
      },
    ])
  }
  if (props.canManage) groups.push([{ label: draft.value.alias ? 'Change alias' : 'Set an alias', icon: EditPencil, onSelect: openAlias }])
  if (props.canManage && saved.value) groups.push([{ label: 'Delete template', icon: Trash, color: 'error', onSelect: () => (deleting.value = true) }])
  return groups
})

const status = computed(() => {
  if (save.isPending.value) return { tone: 'busy', label: 'Saving…' }
  if (isNew.value) return { tone: 'idle', label: 'Not saved yet' }
  if (dirty.value) return { tone: 'dirty', label: 'Unsaved changes' }
  return { tone: 'idle', label: 'Draft saved' }
})

const savedAt = computed(() => (saved.value ? `${formatRelativeTime(saved.value.updatedAt)}${saved.value.updatedBy ? ` by ${saved.value.updatedBy.name}` : ''}` : null))

const tabs = computed(() => [
  { value: 'block' as const, label: 'Block' },
  { value: 'style' as const, label: 'Style' },
  { value: 'variables' as const, label: `Variables${effectiveVariables.value.length ? ` ${effectiveVariables.value.length}` : ''}` },
])

const nameInputWidth = computed(() => `${Math.min(Math.max(draft.value.name.length, 10), 48) + 2}ch`)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-3">
      <RouterLink
        :to="{ name: 'templates', params: { organizationId } }"
        class="inline-flex h-8 shrink-0 items-center gap-1 rounded-sm pl-1 pr-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
      >
        <NavArrowLeft aria-hidden="true" class="size-4" />Templates
      </RouterLink>
      <span aria-hidden="true" class="h-5 w-px bg-slate-200" />
      <div class="flex min-w-0 items-center gap-2">
        <input
          v-model="draft.name"
          type="text"
          aria-label="Template name"
          maxlength="100"
          :readonly="readonly"
          :style="{ width: nameInputWidth }"
          class="h-8 min-w-0 max-w-full rounded-sm bg-transparent px-1.5 text-base font-semibold text-slate-900 outline-none ring-1 ring-transparent transition-shadow hover:ring-slate-200 focus:bg-white focus:ring-slate-400 motion-reduce:transition-none"
          :class="nameError && 'ring-red-300'"
          @input="nameError = null"
        />
        <button
          v-if="draft.alias || canManage"
          type="button"
          class="hidden h-6 shrink-0 items-center rounded-sm px-1.5 font-mono text-[11px] ring-1 transition-colors sm:inline-flex"
          :class="draft.alias ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'text-slate-400 ring-dashed ring-slate-200 hover:text-slate-700'"
          :disabled="!canManage"
          :title="draft.alias ? 'Send with this alias instead of the id' : 'Give it a readable name to send with'"
          @click="openAlias"
        >{{ draft.alias ?? '+ alias' }}</button>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500" :title="savedAt ?? undefined" aria-live="polite">
          <span
            aria-hidden="true"
            class="size-1.5 rounded-full"
            :class="{ 'bg-status-attention': status.tone === 'dirty', 'animate-pulse bg-status-active motion-reduce:animate-none': status.tone === 'busy', 'bg-slate-300': status.tone === 'idle' }"
          />{{ status.label }}
        </span>
        <button
          v-if="saved"
          type="button"
          class="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-sm px-2 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
          aria-label="Version history"
          title="Version history"
          @click="openHistory()"
        >
          <ClockRotateRight aria-hidden="true" class="size-3.5 shrink-0 text-slate-500" />
          <ReleaseStatus :published-version="saved.publishedVersion" :has-unpublished-changes="saved.hasUnpublishedChanges" compact />
        </button>
        <SegmentedControl
          v-model="mode"
          label="View"
          :options="[{ value: 'edit', label: 'Edit', icon: EditPencil }, { value: 'preview', label: 'Preview', icon: Eye }]"
          class="w-44"
        />
        <UDropdownMenu v-if="menu.length" :items="menu" :content="{ align: 'end', sideOffset: 4 }" :ui="{ content: 'w-56 rounded-sm', item: 'rounded-sm text-sm' }">
          <button type="button" class="flex size-8 items-center justify-center rounded-sm text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950 data-[state=open]:bg-slate-100" aria-label="More actions">
            <MoreHoriz aria-hidden="true" class="size-4" />
          </button>
        </UDropdownMenu>
        <UTooltip :text="isNew ? 'Save the template first' : dirty ? 'Save your changes first' : 'Send the saved draft to yourself'" :content="{ side: 'bottom' }">
          <span>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              size="md"
              :disabled="isNew || dirty"
              class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100"
              @click="sending = true"
            >
              <SendDiagonal aria-hidden="true" class="size-4" />Send test
            </UButton>
          </span>
        </UTooltip>
        <UButton
          v-if="canManage && isNew"
          type="button"
          size="md"
          :loading="save.isPending.value"
          class="h-8 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40"
          @click="trySave"
        >
          Create template<kbd class="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">⌘S</kbd>
        </UButton>
        <template v-else-if="canManage">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            size="md"
            :loading="save.isPending.value && !publishing"
            :disabled="!dirty"
            class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
            @click="trySave"
          >
            Save<kbd class="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">⌘S</kbd>
          </UButton>
          <UTooltip :text="hasSomethingToPublish ? (dirty ? 'Saves your changes, then publishes' : 'Send emails with this draft') : 'The live version already matches the draft'" :content="{ side: 'bottom' }">
            <span>
              <UButton
                type="button"
                size="md"
                :disabled="!hasSomethingToPublish || save.isPending.value"
                class="h-8 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40"
                @click="startPublish"
              >Publish</UButton>
            </span>
          </UTooltip>
        </template>
      </div>
    </div>

    <div v-if="conflict !== null || saveError || nameError || readonly || (showIssues && issues.length)" class="mt-4 grid gap-2">
      <div v-if="showIssues && issues.length" role="alert" class="rounded-sm bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
        <p class="m-0 flex items-center gap-2 text-sm font-medium text-amber-900">
          <WarningCircle aria-hidden="true" class="size-4 shrink-0 text-amber-700" />{{ issues.length === 1 ? 'One thing to fix before saving' : `${issues.length} things to fix before saving` }}
        </p>
        <ul class="m-0 mt-2 grid list-none gap-1 p-0 pl-6">
          <li v-for="(issue, index) in issues" :key="index">
            <button type="button" class="text-left text-sm text-amber-900 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-700" @click="goToIssue(issue.pos)">{{ issue.message }}</button>
          </li>
        </ul>
      </div>
      <div v-if="conflict !== null" role="alert" class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
        <WarningCircle aria-hidden="true" class="size-4 shrink-0 text-amber-700" />
        <p class="m-0 min-w-0 flex-1 text-sm text-amber-900">Someone saved this template while you were editing<template v-if="conflict"> (it’s now revision {{ conflict }})</template>. Your changes aren’t saved yet.</p>
        <div class="flex gap-2">
          <button type="button" class="h-8 rounded-sm px-3 text-sm font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100" @click="loadTheirs">Load their version</button>
          <button type="button" class="h-8 rounded-sm bg-amber-900 px-3 text-sm font-medium text-white hover:bg-amber-950" @click="save.mutate({ overwrite: true })">Save mine over it</button>
        </div>
      </div>
      <p v-if="saveError" role="alert" class="m-0 flex items-start gap-2 rounded-sm bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
        <WarningCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0" />{{ saveError }}
      </p>
      <p v-if="nameError" role="alert" class="m-0 rounded-sm bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{{ nameError }}</p>
      <p v-if="readonly" class="m-0 rounded-sm bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">You can view and preview this template. Owners and admins can change it.</p>
    </div>

    <div class="mt-4 flex items-center gap-3 rounded-sm bg-white px-3 ring-1 ring-slate-200 focus-within:ring-slate-400">
      <label for="template-subject" class="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Subject</label>
      <input
        id="template-subject"
        v-model="draft.subject"
        type="text"
        maxlength="998"
        :readonly="readonly"
        placeholder="What the inbox shows. Use {{first_name}} for variables."
        class="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      <span v-if="!draft.subject.trim() && !readonly" class="shrink-0 text-xs text-amber-700">Required</span>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0">
        <div v-show="mode === 'edit'">
          <TemplateCanvas v-model:device="device" :editor="editor" :theme="theme" :declared="draft.variables.map((variable) => variable.key)" :readonly="readonly" />
        </div>
        <TemplatePreview
          v-if="mode === 'preview'"
          v-model:device="device"
          :organization-id="organizationId"
          :subject="draft.subject"
          :content="previewContent"
          :theme="draft.theme"
          :variables="effectiveVariables"
          :samples="samples"
        />
      </div>

      <aside class="lg:sticky lg:top-4 lg:self-start" aria-label="Template settings">
        <div class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
          <div class="border-b border-slate-100 p-2">
            <SegmentedControl v-model="tab" label="Settings" :options="tabs" />
          </div>
          <div class="max-h-[calc(100vh-14rem)] overflow-y-auto [scrollbar-width:thin]">
            <template v-if="tab === 'block'">
              <BlockPanel v-if="editor && mode === 'edit'" :editor="editor" :revision="revision" :readonly="readonly" />
              <p v-else class="m-0 px-4 py-8 text-center text-xs text-slate-500">Switch to Edit to change blocks.</p>
            </template>
            <StylePanel v-else-if="tab === 'style'" v-model="themeModel" :readonly="readonly" />
            <VariablesPanel
              v-else
              v-model="variablesModel"
              v-model:samples="samples"
              :counts="counts"
              :undeclared="undeclared"
              :readonly="readonly"
              :can-insert="mode === 'edit' && !readonly"
              @insert="insertVariable"
            />
          </div>
        </div>
      </aside>
    </div>

    <PublishModal v-if="saved" v-model:open="publishing" :organization-id="organizationId" :template="saved" :samples="samples" @published="onPublished" />
    <VersionHistory
      v-if="saved"
      v-model:open="historyOpen"
      :organization-id="organizationId"
      :template="saved"
      :can-manage="canManage"
      :dirty="dirty"
      :samples="samples"
      :focus="historyFocus"
      @changed="onHistoryChanged"
    />
    <SendTestModal v-if="saved" v-model:open="sending" :organization-id="organizationId" :template-id="saved.id" :variables="saved.variables" :samples="samples" />
    <ApiUsageModal v-if="saved" v-model:open="showApi" :reference="saved.alias ?? saved.id" :variables="saved.variables" :published-version="saved.publishedVersion" />

    <FramedModal v-model:open="editingAlias" title="Alias" description="A readable name to send with, like welcome or password-reset. Your code can use it instead of the id." width="md">
      <form id="alias-form" novalidate @submit.prevent="applyAlias">
        <input
          v-model="aliasDraft"
          type="text"
          aria-label="Alias"
          placeholder="welcome"
          spellcheck="false"
          maxlength="63"
          class="h-9 w-full rounded-sm bg-white px-2.5 font-mono text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-slate-400"
          :aria-invalid="Boolean(aliasError)"
          @input="aliasError = null"
        />
        <p v-if="aliasError" role="alert" class="m-0 mt-1.5 text-xs text-red-600">{{ aliasError }}</p>
        <p v-else class="m-0 mt-1.5 text-xs text-slate-500">Leave empty to remove it. Saved with the template.</p>
      </form>
      <template #footer>
        <ModalActions action="Apply" form="alias-form" @cancel="editingAlias = false" />
      </template>
    </FramedModal>

    <ConfirmModal
      v-model:open="deleting"
      :title="`Delete ${draft.name}?`"
      description="Sends that use it will fail with ATL_TEMPLATE_NOT_FOUND. Emails already sent keep their content."
      action="Delete template"
      :pending="remove.isPending.value"
      :error="remove.error.value?.message"
      @confirm="remove.mutate()"
    />

    <FramedModal v-model:open="leaving" title="Leave without saving?" description="Your changes to this template will be lost.">
      <template #footer>
        <ModalActions action="Leave" cancel-label="Keep editing" @cancel="settleLeave(false)" @confirm="settleLeave(true)" />
      </template>
    </FramedModal>
  </div>
</template>
