<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import CopyButton from '../../../../components/shared/CopyButton.vue'
import { formatRelativeTime } from '../../../../lib/format/relative-time'
import { addDomain, domainQueryKey, getDomain, verifyDomain, type DnsRecord } from '../../api/domains'
import { overviewQueryKey, type Overview } from '../../api/get-overview'
import { DOMAIN_STATUS } from '../../lib/email-status'
import { primaryDomain } from '../../lib/setup'

const props = defineProps<{ organizationId: string; overview: Overview }>()

const queryClient = useQueryClient()
const existing = computed(() => primaryDomain(props.overview))
const domainId = computed(() => existing.value?.id ?? '')

const { data: domain, isPending } = useQuery({
  queryKey: computed(() => domainQueryKey(props.organizationId, domainId.value)),
  queryFn: () => getDomain(props.organizationId, domainId.value),
  enabled: computed(() => !!domainId.value),
  refetchInterval: (query) => (query.state.data?.status === 'pending' ? 15_000 : false),
})

const refreshOverview = () => queryClient.invalidateQueries({ queryKey: overviewQueryKey(props.organizationId) })

const name = ref('')
const add = useMutation({
  mutationFn: () => addDomain(props.organizationId, name.value.trim().toLowerCase()),
  async onSuccess(created) {
    queryClient.setQueryData(domainQueryKey(props.organizationId, created.id), created)
    name.value = ''
    await refreshOverview()
  },
})

const verify = useMutation({
  mutationFn: () => verifyDomain(props.organizationId, domainId.value),
  async onSuccess(updated) {
    queryClient.setQueryData(domainQueryKey(props.organizationId, updated.id), updated)
    await refreshOverview()
  },
})

const validName = computed(() => /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(name.value.trim()))

const recordLabel: Record<DnsRecord['record'], string> = {
  DKIM: 'Signs your emails (DKIM)',
  MAIL_FROM: 'Bounce handling (MAIL FROM)',
  SPF: 'Allows SES to send (SPF)',
  DMARC: 'Tells inboxes what to do (DMARC)',
}

const requiredRecords = computed(() => domain.value?.records.filter((record) => record.required) ?? [])
const optionalRecords = computed(() => domain.value?.records.filter((record) => !record.required) ?? [])

function displayValue(record: DnsRecord) {
  return record.priority !== undefined ? `${record.priority} ${record.value}` : record.value
}

function submit() {
  if (validName.value && !add.isPending.value) add.mutate()
}
</script>

<template>
  <div class="grid gap-4">
    <form v-if="!existing" class="grid gap-3" novalidate @submit.prevent="submit">
      <p class="m-0 max-w-2xl text-sm leading-relaxed text-slate-600">
        Use a domain you control. A subdomain like <span class="font-mono text-slate-800">mail.yourcompany.com</span> keeps email reputation separate from your main domain.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-full max-w-sm">
          <label for="domain-name" class="block text-xs font-medium text-slate-700">Domain</label>
          <UInput id="domain-name" v-model="name" size="lg" autocomplete="off" spellcheck="false" placeholder="mail.yourcompany.com" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="add.isPending.value" />
        </div>
        <UButton type="submit" size="md" :loading="add.isPending.value" :disabled="!validName" class="h-10 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">Add domain</UButton>
      </div>
      <p v-if="add.error.value" role="alert" class="m-0 text-sm text-red-600">{{ add.error.value.message }}</p>
    </form>

    <div v-else-if="isPending" class="skeleton-card h-40 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading DNS records" />

    <template v-else-if="domain">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="m-0 flex items-center gap-2 text-sm">
          <span aria-hidden="true" class="size-2 rounded-full" :class="DOMAIN_STATUS[domain.status].dot" />
          <span class="font-mono font-medium text-slate-900">{{ domain.name }}</span>
          <span class="text-slate-500">{{ DOMAIN_STATUS[domain.status].label }}<template v-if="domain.lastCheckedAt"> · checked {{ formatRelativeTime(domain.lastCheckedAt) }}</template></span>
        </p>
        <UButton v-if="domain.status !== 'verified'" type="button" size="sm" color="neutral" variant="outline" :loading="verify.isPending.value" class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="verify.mutate()">
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

      <div v-for="group in [{ title: 'Required', records: requiredRecords }, { title: 'Recommended', records: optionalRecords }]" :key="group.title" v-show="group.records.length" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
        <p class="m-0 border-b border-slate-100 px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{{ group.title }}</p>
        <ul class="m-0 list-none divide-y divide-slate-100 p-0">
          <li v-for="record in group.records" :key="`${record.type}-${record.name}-${record.value}`" class="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[4rem_minmax(0,1fr)_7rem] sm:items-start sm:gap-4">
            <span class="font-mono text-xs font-semibold text-slate-700">{{ record.type }}</span>
            <div class="grid min-w-0 gap-1.5">
              <p class="m-0 text-xs text-slate-500">{{ recordLabel[record.record] }}</p>
              <div class="flex min-w-0 items-center gap-2">
                <span class="w-12 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Name</span>
                <code class="min-w-0 flex-1 truncate font-mono text-xs text-slate-900" :title="record.name">{{ record.name }}</code>
                <CopyButton :value="record.name" />
              </div>
              <div class="flex min-w-0 items-center gap-2">
                <span class="w-12 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Value</span>
                <code class="min-w-0 flex-1 truncate font-mono text-xs text-slate-900" :title="displayValue(record)">{{ displayValue(record) }}</code>
                <CopyButton :value="displayValue(record)" />
              </div>
            </div>
            <span v-if="record.status" class="inline-flex items-center gap-1.5 text-xs text-slate-600 sm:justify-end">
              <span aria-hidden="true" class="size-2 rounded-full" :class="DOMAIN_STATUS[record.status].dot" />{{ record.status === 'verified' ? 'Found' : record.status === 'failed' ? 'Not found' : 'Waiting' }}
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
