<script setup lang="ts">
import { Globe, Plus } from '@iconoir/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { DataTable, type TableColumn } from '../../../components/data-table'
import AuditStamp from '../../../components/shared/AuditStamp.vue'
import EmptyState from '../../../components/shared/EmptyState.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { useCurrentOrganization } from '../../organizations'
import { getProvider, providerQueryKey } from '../../settings'
import { domainsQueryKey, listDomains, type Domain } from '../api/domains'
import AddDomainForm from '../components/AddDomainForm.vue'
import { DOMAIN_STATUS, STATUS_BADGE } from '../lib/domain-status'

const router = useRouter()
const { organizationId, canManage } = useCurrentOrganization()
const adding = ref(false)
const addForm = useTemplateRef<{ pending: boolean; canSubmit: boolean }>('addForm')

const query = useQuery({
  queryKey: computed(() => domainsQueryKey(organizationId.value)),
  queryFn: () => listDomains(organizationId.value),
  refetchInterval: (state) => (state.state.data?.some((domain) => domain.status === 'pending') ? 15_000 : false),
})
const { data: provider } = useQuery({
  queryKey: computed(() => providerQueryKey(organizationId.value)),
  queryFn: () => getProvider(organizationId.value),
  staleTime: 60_000,
})

const domains = computed(() =>
  [...(query.data.value ?? [])].sort((a, b) => ['failed', 'pending', 'verified'].indexOf(a.status) - ['failed', 'pending', 'verified'].indexOf(b.status) || a.name.localeCompare(b.name)),
)
const columns: TableColumn[] = [
  { key: 'name', label: 'Domain' },
  { key: 'status', label: 'Status', width: 'w-40' },
  { key: 'region', label: 'Region', width: 'w-32', hideBelow: 'sm' },
  { key: 'created', label: 'Created', width: 'w-44', hideBelow: 'md' },
  { key: 'updated', label: 'Updated', width: 'w-44', hideBelow: 'lg' },
]

function opened(domain: Domain) {
  adding.value = false
  router.push({ name: 'domain', params: { organizationId: organizationId.value, domainId: domain.id } })
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Domains" title="Sending domains" description="Send from domains you own. Each one is verified with Amazon SES.">
      <template v-if="canManage && domains.length" #actions>
        <UButton type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="adding = true">
          <Plus aria-hidden="true" class="size-4" />Add domain
        </UButton>
      </template>
    </PageHeader>

    <div v-if="query.isPending.value" class="mt-8 skeleton-card h-40 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading domains" />

    <LoadErrorCard v-else-if="query.isError.value" class="mt-8" :error="query.error.value" subject="your domains" @retry="query.refetch()" />

    <EmptyState v-else-if="domains.length === 0" class="mt-8" title="No domains yet" description="Add the domain you’ll send from, then publish its DNS records.">
      <template #icon><Globe class="size-5" /></template>
      <UButton v-if="canManage" type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900" @click="adding = true">
        <Plus aria-hidden="true" class="size-4" />Add a domain
      </UButton>
      <p v-else class="m-0 text-xs text-slate-500">An owner or admin can add domains.</p>
    </EmptyState>

    <DataTable
      v-else
      class="mt-8"
      label="Domains"
      :columns="columns"
      :rows="domains"
      :row-key="(domain) => domain.id"
      :row-to="(domain) => ({ name: 'domain', params: { organizationId, domainId: domain.id } })"
      :row-label="(domain) => `${domain.name}, ${DOMAIN_STATUS[domain.status].label}`"
    >
      <template #cell-name="{ row }"><span class="block truncate font-medium text-slate-900">{{ row.name }}</span></template>
      <template #cell-status="{ row }">
        <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset" :class="STATUS_BADGE[row.status]">
          <span aria-hidden="true" class="size-1.5 rounded-full" :class="DOMAIN_STATUS[row.status].dot" />{{ DOMAIN_STATUS[row.status].label }}
        </span>
      </template>
      <template #cell-region><span class="font-mono text-xs text-slate-600">{{ provider?.region ?? '—' }}</span></template>
      <template #cell-created="{ row }"><AuditStamp :at="row.createdAt" :by="row.createdBy" /></template>
      <template #cell-updated="{ row }"><AuditStamp :at="row.updatedAt" :by="row.updatedBy" /></template>
    </DataTable>

    <FramedModal v-model:open="adding" title="Add a sending domain" description="It’s registered in your SES account, and you get the DNS records to publish." width="xl">
      <AddDomainForm ref="addForm" :organization-id="organizationId" in-modal @created="opened" />
      <template #footer>
        <ModalActions action="Add domain" form="add-domain-form" :pending="addForm?.pending" :disabled="!addForm?.canSubmit" @cancel="adding = false" />
      </template>
    </FramedModal>
  </div>
</template>
