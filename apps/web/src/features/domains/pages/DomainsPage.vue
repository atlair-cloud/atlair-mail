<script setup lang="ts">
import { Globe, Plus } from '@iconoir/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../../components/shared/EmptyState.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
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

    <div v-else class="mt-8 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
      <table class="w-full table-fixed border-collapse text-sm">
        <thead class="border-b border-slate-100 text-left">
          <tr class="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
            <th scope="col" class="px-4 py-2.5 font-medium">Domain</th>
            <th scope="col" class="w-40 px-4 py-2.5 font-medium">Status</th>
            <th scope="col" class="hidden w-36 px-4 py-2.5 font-medium sm:table-cell">Region</th>
            <th scope="col" class="hidden w-36 px-4 py-2.5 font-medium md:table-cell">Added</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="domain in domains" :key="domain.id" class="relative transition-colors hover:bg-slate-50 motion-reduce:transition-none">
            <td class="px-4 py-3">
              <RouterLink
                :to="{ name: 'domain', params: { organizationId, domainId: domain.id } }"
                class="block truncate font-medium text-slate-900 outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-atlair-950"
              >{{ domain.name }}</RouterLink>
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset" :class="STATUS_BADGE[domain.status]">
                <span aria-hidden="true" class="size-1.5 rounded-full" :class="DOMAIN_STATUS[domain.status].dot" />{{ DOMAIN_STATUS[domain.status].label }}
              </span>
            </td>
            <td class="hidden px-4 py-3 font-mono text-xs text-slate-600 sm:table-cell">{{ provider?.region ?? '—' }}</td>
            <td class="hidden px-4 py-3 text-slate-600 md:table-cell">{{ formatRelativeTime(domain.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <FramedModal v-model:open="adding" title="Add a sending domain" description="It’s registered in your SES account, and you get the DNS records to publish." width="xl">
      <AddDomainForm ref="addForm" :organization-id="organizationId" in-modal @created="opened" />
      <template #footer>
        <ModalActions action="Add domain" form="add-domain-form" :pending="addForm?.pending" :disabled="!addForm?.canSubmit" @cancel="adding = false" />
      </template>
    </FramedModal>
  </div>
</template>
