<script setup lang="ts">
import { NavArrowLeft, Refresh } from '@iconoir/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import NotFound from '../../../components/shared/NotFound.vue'
import SettingsCard from '../../../components/shared/SettingsCard.vue'
import { ApiError } from '../../../lib/api/client'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { useCurrentOrganization } from '../../organizations'
import { getProvider, providerQueryKey } from '../../settings'
import { domainQueryKey, getDomain, removeDomain, verifyDomain } from '../api/domains'
import DnsRecordsTable from '../components/DnsRecordsTable.vue'
import { DOMAIN_STATUS, STATUS_BADGE } from '../lib/domain-status'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()
const { organizationId, canManage } = useCurrentOrganization()
const domainId = computed(() => String(route.params.domainId))

const query = useQuery({
  queryKey: computed(() => domainQueryKey(organizationId.value, domainId.value)),
  queryFn: () => getDomain(organizationId.value, domainId.value),
  refetchInterval: (state) => (state.state.data?.status === 'pending' ? 15_000 : false),
})
const domain = computed(() => query.data.value)
const notFound = computed(() => query.error.value instanceof ApiError && query.error.value.status === 404)

const { data: provider } = useQuery({
  queryKey: computed(() => providerQueryKey(organizationId.value)),
  queryFn: () => getProvider(organizationId.value),
  staleTime: 60_000,
})

const check = useMutation({
  mutationFn: () => verifyDomain(organizationId.value, domainId.value),
  async onSuccess(updated) {
    queryClient.setQueryData(domainQueryKey(organizationId.value, updated.id), updated)
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    toast.add({
      title: updated.status === 'verified' ? `${updated.name} is verified` : 'Checked with Amazon SES',
      description: updated.status === 'verified' ? 'You can send from it now.' : 'Not all records are visible yet. This page keeps checking.',
      color: 'neutral',
    })
  },
  onError: (error) => toast.add({ title: 'Couldn’t check the domain', description: error.message, color: 'error' }),
})

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const facts = computed(() =>
  domain.value
    ? [
        { label: 'Added', value: absolute.format(new Date(domain.value.createdAt)) },
        { label: 'Region', value: provider.value?.region ?? '—', mono: true },
        { label: 'Last checked', value: domain.value.lastCheckedAt ? formatRelativeTime(domain.value.lastCheckedAt) : 'Not yet' },
      ]
    : [],
)

const confirming = ref(false)
const remove = useMutation({
  mutationFn: () => removeDomain(organizationId.value, domainId.value),
  async onSuccess() {
    const name = domain.value?.name
    confirming.value = false
    queryClient.removeQueries({ queryKey: domainQueryKey(organizationId.value, domainId.value) })
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    await router.replace({ name: 'domains', params: { organizationId: organizationId.value } })
    toast.add({ title: `${name} removed`, description: 'It stays registered in your SES account.', color: 'neutral' })
  },
})
</script>

<template>
  <div>
    <RouterLink :to="{ name: 'domains', params: { organizationId } }" class="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950">
      <NavArrowLeft aria-hidden="true" class="size-4" />All domains
    </RouterLink>

    <div v-if="query.isPending.value" class="mt-6 grid gap-4" aria-busy="true" aria-label="Loading the domain">
      <div class="skeleton h-8 w-72 rounded-sm" />
      <div class="skeleton-card h-28 rounded-md ring-1 ring-slate-200" />
      <div class="skeleton-card h-72 rounded-md ring-1 ring-slate-200" />
    </div>

    <NotFound v-else-if="notFound" title="We couldn’t find that domain" body="It may have been removed, or it belongs to another organization." :to="{ name: 'domains', params: { organizationId } }" to-label="Go to domains" />

    <LoadErrorCard v-else-if="query.isError.value" class="mt-6" :error="query.error.value" subject="this domain" @retry="query.refetch()" />

    <template v-else-if="domain">
      <header class="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <h1 tabindex="-1" class="m-0 break-all text-[28px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ domain.name }}</h1>
          <span class="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset" :class="STATUS_BADGE[domain.status]" aria-live="polite">
            <span aria-hidden="true" class="size-1.5 rounded-full" :class="DOMAIN_STATUS[domain.status].dot" />{{ DOMAIN_STATUS[domain.status].label }}
          </span>
        </div>
        <UButton
          v-if="canManage && domain.status !== 'verified'"
          type="button"
          size="md"
          :loading="check.isPending.value"
          class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900"
          @click="check.mutate()"
        >
          <Refresh v-if="!check.isPending.value" aria-hidden="true" class="size-4" />Check now
        </UButton>
      </header>

      <dl class="m-0 mt-6 grid grid-cols-2 gap-x-10 gap-y-4 border-y border-slate-200 py-4 sm:flex sm:flex-wrap">
        <div v-for="fact in facts" :key="fact.label">
          <dt class="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{{ fact.label }}</dt>
          <dd class="m-0 mt-1 text-sm text-slate-900" :class="fact.mono && 'font-mono'">{{ fact.value }}</dd>
        </div>
      </dl>

      <p v-if="domain.status === 'failed'" role="alert" class="m-0 mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
        Amazon SES couldn’t find the records. Check they match exactly, then check again.
      </p>

      <section aria-labelledby="records-heading" class="mt-8">
        <h2 id="records-heading" class="m-0 text-base font-semibold text-slate-900">DNS records</h2>
        <p class="m-0 mt-1 text-sm text-slate-600">{{ domain.status === 'verified' ? 'Keep these in place.' : 'Add these at your DNS provider.' }}</p>
        <DnsRecordsTable class="mt-5" :records="domain.records" />
      </section>

      <div v-if="canManage" class="mt-12 border-t border-slate-200 pt-8">
        <SettingsCard tone="danger" title="Remove domain" :description="`Stop sending from ${domain.name}. It stays in your SES account.`">
          <template #footer>
            <p class="m-0 text-xs text-red-800">A domain that has sent emails can’t be removed.</p>
            <UButton type="button" size="md" color="neutral" variant="outline" class="h-9 shrink-0 rounded-sm bg-white px-3.5 text-sm font-medium text-red-700 ring-red-200 hover:bg-red-50 hover:ring-red-300" @click="remove.reset(); confirming = true">Remove…</UButton>
          </template>
        </SettingsCard>
        <ConfirmModal
          v-model:open="confirming"
          :title="`Remove ${domain.name}?`"
          description="Emails can no longer be sent from it until you add it again."
          action="Remove domain"
          :confirm-text="domain.name"
          :pending="remove.isPending.value"
          :error="remove.error.value?.message"
          @confirm="remove.mutate()"
        />
      </div>
    </template>
  </div>
</template>
