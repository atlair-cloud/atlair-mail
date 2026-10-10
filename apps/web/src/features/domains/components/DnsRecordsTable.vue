<script setup lang="ts">
import { computed } from 'vue'
import CopyButton from '../../../components/shared/CopyButton.vue'
import type { DnsRecord } from '../api/domains'
import { DOMAIN_STATUS } from '../lib/domain-status'

const props = defineProps<{ records: DnsRecord[] }>()

const groups = computed(() =>
  [
    { title: 'DKIM', tag: 'Required', records: props.records.filter((record) => record.record === 'DKIM') },
    { title: 'SPF', tag: 'Recommended', records: props.records.filter((record) => record.record === 'MAIL_FROM' || record.record === 'SPF') },
    { title: 'DMARC', tag: 'Optional', records: props.records.filter((record) => record.record === 'DMARC') },
  ].filter((group) => group.records.length > 0),
)

const statusLabel = (status: DnsRecord['status']) => (status === 'verified' ? 'Found' : status === 'failed' ? 'Not found' : status === 'pending' ? 'Waiting' : 'Not checked')
const statusDot = (status: DnsRecord['status']) => (status ? DOMAIN_STATUS[status].dot : 'bg-slate-300')
</script>

<template>
  <div class="grid gap-6">
    <section v-for="group in groups" :key="group.title" :aria-label="group.title">
      <h3 class="m-0 mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {{ group.title }}
        <span class="rounded-sm bg-slate-100 px-1.5 py-px text-[11px] font-medium text-slate-600">{{ group.tag }}</span>
      </h3>
      <div class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
        <div class="hidden grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.4fr)_6rem] gap-4 border-b border-slate-100 px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500 md:grid">
          <span>Type</span><span>Name</span><span>Value</span><span class="text-right">Status</span>
        </div>
        <ul class="m-0 list-none divide-y divide-slate-100 p-0">
          <li
            v-for="record in group.records"
            :key="`${record.type}-${record.name}-${record.value}`"
            class="grid gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.4fr)_6rem] md:items-center"
          >
            <span class="font-mono text-xs font-semibold text-slate-900">{{ record.type }}</span>
            <span class="flex min-w-0 items-center gap-1">
              <code class="min-w-0 truncate font-mono text-xs text-slate-800" :title="record.name">{{ record.name }}</code>
              <CopyButton :value="record.name" label="Copy name" icon-only />
            </span>
            <span class="flex min-w-0 items-center gap-1">
              <span v-if="record.priority !== undefined" class="shrink-0 rounded-[3px] bg-slate-100 px-1 font-mono text-[11px] text-slate-600" :title="`Priority ${record.priority}`">{{ record.priority }}</span>
              <code class="min-w-0 truncate font-mono text-xs text-slate-800" :title="record.value">{{ record.value }}</code>
              <CopyButton :value="record.value" label="Copy value" icon-only />
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs text-slate-600 md:justify-end">
              <span aria-hidden="true" class="size-2 rounded-full" :class="statusDot(record.status)" />{{ statusLabel(record.status) }}
            </span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
