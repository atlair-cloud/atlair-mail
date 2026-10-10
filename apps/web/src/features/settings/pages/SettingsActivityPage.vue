<script setup lang="ts">
import { Journal } from '@iconoir/vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import EmptyState from '../../../components/shared/EmptyState.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { useCurrentOrganization } from '../../organizations'
import { auditLogQueryKey, auditPageSize, listAuditLog } from '../api/audit-log'
import { listMembers, membersQueryKey } from '../api/members'
import { auditActorName, describeAuditEntry } from '../lib/describe-audit-entry'

const { organizationId, canManage } = useCurrentOrganization()

const query = useInfiniteQuery({
  queryKey: computed(() => auditLogQueryKey(organizationId.value)),
  queryFn: ({ pageParam }) => listAuditLog(organizationId.value, pageParam),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => (lastPage.length === auditPageSize ? lastPage.at(-1)?.id : undefined),
  enabled: canManage,
})
const entries = computed(() => query.data.value?.pages.flat() ?? [])

const members = useQuery({
  queryKey: computed(() => membersQueryKey(organizationId.value)),
  queryFn: () => listMembers(organizationId.value),
})
const personName = (userId: string | undefined) => members.data.value?.find((member) => member.userId === userId)?.name ?? 'a former member'

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <p v-if="!canManage" class="m-0 text-sm text-slate-600">Only owners and admins can see the audit log.</p>

  <div v-else-if="query.isPending.value" class="skeleton-card h-56 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading the audit log" />

  <LoadErrorCard v-else-if="query.isError.value" :error="query.error.value" subject="the audit log" @retry="query.refetch()" />

  <EmptyState v-else-if="entries.length === 0" title="Nothing recorded yet" description="Changes to members, API keys, domains, templates, webhooks and the provider appear here.">
    <template #icon><Journal class="size-5" /></template>
  </EmptyState>

  <div v-else>
    <p class="m-0 mb-4 text-sm text-slate-600">Who changed what in this organization, from the panel or with an API key, newest first. Sent emails are on the <RouterLink :to="{ name: 'emails', params: { organizationId } }" class="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">Emails page</RouterLink>.</p>
    <ol class="m-0 list-none divide-y divide-slate-100 overflow-hidden rounded-md bg-white p-0 ring-1 ring-slate-200">
      <li v-for="entry in entries" :key="entry.id" class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3 text-sm">
        <p class="m-0 min-w-0">
          <span class="font-medium text-slate-900">{{ auditActorName(entry) }}</span><span class="text-slate-700">{{ ` ${describeAuditEntry(entry, personName)}` }}</span>
        </p>
        <time :datetime="entry.createdAt" :title="absolute.format(new Date(entry.createdAt))" class="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(entry.createdAt) }}</time>
      </li>
    </ol>
    <div v-if="query.hasNextPage.value" class="mt-4 text-right">
      <UButton type="button" size="sm" color="neutral" variant="outline" :loading="query.isFetchingNextPage.value" class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100" @click="query.fetchNextPage()">Load older</UButton>
    </div>
  </div>
</template>
