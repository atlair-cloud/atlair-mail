<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { domainQueryKey, getDomain, verifyDomain } from '../api/domains'
import { DOMAIN_STATUS } from '../lib/domain-status'
import DnsRecordsTable from './DnsRecordsTable.vue'

const props = withDefaults(defineProps<{ organizationId: string; domainId: string; canManage: boolean; showName?: boolean }>(), { showName: true })

const queryClient = useQueryClient()

const { data: domain, isPending } = useQuery({
  queryKey: computed(() => domainQueryKey(props.organizationId, props.domainId)),
  queryFn: () => getDomain(props.organizationId, props.domainId),
  refetchInterval: (query) => (query.state.data?.status === 'pending' ? 15_000 : false),
})

const verify = useMutation({
  mutationFn: () => verifyDomain(props.organizationId, props.domainId),
  async onSuccess(updated) {
    queryClient.setQueryData(domainQueryKey(props.organizationId, updated.id), updated)
    await queryClient.invalidateQueries({ queryKey: ['organizations', props.organizationId] })
  },
})
</script>

<template>
  <div v-if="isPending" class="skeleton-card h-48 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading DNS records" />

  <div v-else-if="domain" class="grid gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="m-0 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span aria-hidden="true" class="size-2 rounded-full" :class="DOMAIN_STATUS[domain.status].dot" />
        <span v-if="showName" class="font-mono font-medium text-slate-900">{{ domain.name }}</span>
        <span class="text-slate-600">{{ DOMAIN_STATUS[domain.status].label }}<template v-if="domain.lastCheckedAt"> · checked {{ formatRelativeTime(domain.lastCheckedAt) }}</template></span>
      </p>
      <UButton
        v-if="canManage && domain.status !== 'verified'"
        type="button"
        size="sm"
        color="neutral"
        variant="outline"
        :loading="verify.isPending.value"
        class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100"
        @click="verify.mutate()"
      >
        Check now
      </UButton>
    </div>
    <p v-if="verify.error.value" role="alert" class="m-0 text-sm text-red-600">{{ verify.error.value.message }}</p>

    <p v-if="domain.status === 'pending'" class="m-0 max-w-2xl text-sm leading-relaxed text-slate-600">
      Add these records at your DNS provider (Cloudflare, Route 53, GoDaddy…). Changes usually show up within minutes, sometimes a few hours. This page checks on its own.
    </p>
    <p v-else-if="domain.status === 'failed'" class="m-0 max-w-2xl text-sm leading-relaxed text-red-600">
      SES couldn’t find the records in time. Make sure they match exactly, then check again.
    </p>
    <p v-else class="m-0 max-w-2xl text-sm leading-relaxed text-slate-600">
      Verified{{ domain.verifiedAt ? ` ${formatRelativeTime(domain.verifiedAt)}` : '' }}. Keep these records in place: removing them stops sending from {{ domain.name }}.
    </p>

    <DnsRecordsTable :records="domain.records" />
  </div>
</template>
