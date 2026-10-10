<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import NotFound from '../../../components/shared/NotFound.vue'
import { ApiError } from '../../../lib/api/client'
import { useCurrentOrganization } from '../../organizations'
import { getTemplate, templateQueryKey, type Template } from '../api/templates'
import TemplateWorkspace from '../components/TemplateWorkspace.vue'
import { starterDraft } from '../lib/starters'

const route = useRoute()
const { organizationId, canManage } = useCurrentOrganization()

const routeId = computed(() => String(route.params.templateId))
const createdId = ref<string | null>(null)
const workspaceId = ref(routeId.value)

watch(routeId, (id) => {
  if (id !== createdId.value) workspaceId.value = id
})

const isNew = computed(() => workspaceId.value === 'new')

const starter = ref(String(route.query.starter ?? 'blank'))
watch(
  () => [routeId.value, route.query.starter] as const,
  ([id, value]) => {
    if (id === 'new') starter.value = String(value ?? 'blank')
  },
)
const initialDraft = computed(() => starterDraft(starter.value))

const query = useQuery({
  queryKey: computed(() => templateQueryKey(organizationId.value, workspaceId.value)),
  queryFn: () => getTemplate(organizationId.value, workspaceId.value),
  enabled: computed(() => !isNew.value),
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
})

const notFound = computed(() => query.error.value instanceof ApiError && query.error.value.status === 404)

const toDraft = (template: Template) => ({
  name: template.name,
  alias: template.alias,
  subject: template.subject,
  content: template.content,
  theme: template.theme,
  variables: template.variables,
})

function onCreated(id: string) {
  createdId.value = id
}
</script>

<template>
  <div>
    <TemplateWorkspace
      v-if="isNew"
      :key="`new-${starter}`"
      :organization-id="organizationId"
      :template="null"
      :initial="initialDraft"
      :can-manage="canManage"
      @created="onCreated"
    />
    <div v-else-if="query.isPending.value" aria-busy="true" aria-label="Loading the template" class="grid gap-4">
      <div class="flex items-center gap-3"><div class="skeleton h-8 w-28 rounded-sm" /><div class="skeleton h-8 w-56 rounded-sm" /><div class="skeleton ml-auto h-8 w-64 rounded-sm" /></div>
      <div class="skeleton h-11 rounded-sm" />
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><div class="skeleton h-[560px] rounded-md" /><div class="skeleton h-80 rounded-md" /></div>
    </div>
    <NotFound
      v-else-if="notFound"
      title="We couldn’t find that template"
      body="It may have been deleted, or it belongs to another organization."
      :to="{ name: 'templates', params: { organizationId } }"
      to-label="Go to templates"
    />
    <LoadErrorCard v-else-if="query.isError.value" :error="query.error.value" subject="the template" @retry="query.refetch()" />
    <TemplateWorkspace
      v-else-if="query.data.value"
      :key="query.data.value.id"
      :organization-id="organizationId"
      :template="query.data.value"
      :initial="toDraft(query.data.value)"
      :can-manage="canManage"
    />
  </div>
</template>
