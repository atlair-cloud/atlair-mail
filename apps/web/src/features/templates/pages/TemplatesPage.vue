<script setup lang="ts">
import { Plus } from '@iconoir/vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DataTable, TablePagination, TableSearch, useCursorPages, type TableColumn } from '../../../components/data-table'
import AuditStamp from '../../../components/shared/AuditStamp.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { useCurrentOrganization } from '../../organizations'
import { listTemplates, templatePageSize, templatesQueryKey, type TemplateSummary } from '../api/templates'
import NewTemplateModal from '../components/NewTemplateModal.vue'
import ReleaseStatus from '../components/ReleaseStatus.vue'
import StarterGallery from '../components/StarterGallery.vue'

const route = useRoute()
const router = useRouter()
const { organizationId, canManage } = useCurrentOrganization()
const creating = ref(false)

const search = computed({
  get: () => (typeof route.query.search === 'string' ? route.query.search : ''),
  set: (value: string) => {
    const { search: _previous, ...rest } = route.query
    router.replace({ query: value ? { ...rest, search: value } : rest })
  },
})

const pages = useCursorPages(() => [organizationId.value, search.value])

const query = useQuery({
  queryKey: computed(() => templatesQueryKey(organizationId.value, { search: search.value, before: pages.cursor.value })),
  queryFn: () => listTemplates(organizationId.value, { search: search.value, before: pages.cursor.value }),
  placeholderData: keepPreviousData,
})

const templates = computed(() => query.data.value?.data ?? [])
const empty = computed(() => query.isSuccess.value && templates.value.length === 0 && !search.value && pages.page.value === 1)

const columns: TableColumn[] = [
  { key: 'name', label: 'Template' },
  { key: 'status', label: 'Status', width: 'w-44' },
  { key: 'subject', label: 'Subject', hideBelow: 'md' },
  { key: 'variables', label: 'Variables', width: 'w-40', hideBelow: 'lg' },
  { key: 'updated', label: 'Updated', width: 'w-44', hideBelow: 'sm' },
]

const templateRoute = (template: TemplateSummary) => ({ name: 'template', params: { organizationId: organizationId.value, templateId: template.id } })

function startFrom(starter: string) {
  router.push({ name: 'template', params: { organizationId: organizationId.value, templateId: 'new' }, query: { starter } })
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Templates" title="Email templates" description="Design an email once, then send it from your code with its id and variables.">
      <template v-if="canManage && !empty" #actions>
        <UButton type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="creating = true">
          <Plus aria-hidden="true" class="size-4" />New template
        </UButton>
      </template>
    </PageHeader>

    <LoadErrorCard v-if="query.isError.value && !query.data.value" class="mt-8" :error="query.error.value" subject="templates" @retry="query.refetch()" />

    <section v-else-if="empty" class="mt-8" aria-labelledby="starters-heading">
      <div class="rounded-md bg-white p-6 ring-1 ring-slate-200 sm:p-8">
        <h2 id="starters-heading" class="m-0 text-base font-semibold text-slate-900">Create your first template</h2>
        <p class="mb-0 mt-1 max-w-xl text-sm leading-relaxed text-slate-600">Type <kbd class="rounded-sm bg-slate-100 px-1 font-mono text-xs">/</kbd> to add blocks, <kbd class="rounded-sm bg-slate-100 px-1 font-mono text-xs">{{ '{{' }}</kbd> for variables, and drag the ⋮⋮ handle to move things around.</p>
        <StarterGallery class="mt-6" :columns="4" :disabled="!canManage" @choose="startFrom" />
        <p v-if="!canManage" class="m-0 mt-4 text-xs text-slate-500">An owner or admin can create templates.</p>
      </div>
    </section>

    <DataTable
      v-else
      class="mt-8"
      label="Templates"
      :columns="columns"
      :rows="templates"
      :row-key="(template) => template.id"
      :row-to="templateRoute"
      :row-label="(template) => template.name"
      :loading="query.isPending.value"
      :refreshing="query.isPlaceholderData.value"
      :skeleton-rows="5"
    >
      <template #toolbar>
        <div class="w-full min-w-0 sm:w-auto sm:flex-1">
          <TableSearch v-model="search" label="Search templates" placeholder="Search by name or alias" />
        </div>
      </template>
      <template #cell-name="{ row }">
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate font-medium text-slate-900">{{ row.name }}</span>
          <code v-if="row.alias" class="shrink-0 rounded-sm bg-slate-100 px-1.5 font-mono text-[11px] text-slate-600">{{ row.alias }}</code>
        </span>
        <span class="block truncate text-xs text-slate-500 md:hidden">{{ row.subject }}</span>
      </template>
      <template #cell-status="{ row }"><ReleaseStatus :published-version="row.publishedVersion" :has-unpublished-changes="row.hasUnpublishedChanges" compact /></template>
      <template #cell-subject="{ row }"><span class="block truncate text-slate-600" :title="row.subject">{{ row.subject }}</span></template>
      <template #cell-variables="{ row }">
        <span v-if="row.variables.length" class="flex min-w-0 items-center gap-1 overflow-hidden" :title="row.variables.map((variable) => variable.key).join(', ')">
          <code class="truncate rounded-sm bg-slate-100 px-1.5 font-mono text-[11px] text-slate-600">{{ row.variables[0]!.key }}</code>
          <span v-if="row.variables.length > 1" class="shrink-0 font-mono text-[11px] text-slate-500">+{{ row.variables.length - 1 }}</span>
        </span>
        <span v-else class="text-xs text-slate-400">None</span>
      </template>
      <template #cell-updated="{ row }"><AuditStamp :at="row.updatedAt" :by="row.updatedBy" /></template>
      <template #empty>
        <p class="m-0 text-sm font-medium text-slate-900">No templates match</p>
        <p class="m-0 mt-1 text-sm text-slate-500">Try another name or alias.</p>
      </template>
      <template v-if="templates.length || pages.page.value > 1" #footer>
        <TablePagination
          noun="templates"
          :page="pages.page.value"
          :page-size="templatePageSize"
          :page-sizes="[templatePageSize]"
          :row-count="templates.length"
          :has-next="query.data.value?.hasMore ?? false"
          @previous="pages.previous()"
          @next="pages.next(templates.at(-1)?.id)"
        />
      </template>
    </DataTable>

    <NewTemplateModal v-model:open="creating" :organization-id="organizationId" />
  </div>
</template>
