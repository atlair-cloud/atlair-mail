<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { useNow, useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { DataTable, TableFilter, TablePagination, TableSearch, useCursorPages, type FilterOption, type TableColumn } from '../../../components/data-table'
import AuditStamp from '../../../components/shared/AuditStamp.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { emailsQueryKey, listEmails } from '../api/emails'
import { emailStatuses, type EmailStatus, type EmailSummary } from '../api/types'
import EmailStatusBadge from '../components/EmailStatusBadge.vue'
import { EMAIL_STATUS, isInFlight } from '../lib/email-status'
import { shortFailureReason } from '../lib/timeline'

type Range = '24h' | '7d' | '30d'

const RANGE_HOURS: Record<Range, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }

const route = useRoute()
const router = useRouter()
const now = useNow({ interval: 15_000 })
const organizationId = computed(() => String(route.params.organizationId))
const pageSize = useStorage('atlair-mail:emails:page-size', 50)

const columns: TableColumn[] = [
  { key: 'status', label: 'Status', width: 'w-12 sm:w-32', labelHiddenOnMobile: true },
  { key: 'email', label: 'Email' },
  { key: 'from', label: 'From', width: 'w-64', hideBelow: 'md' },
  { key: 'created', label: 'Created', width: 'w-44', hideBelow: 'sm' },
]

const statusOptions: FilterOption<EmailStatus>[] = (['delivered', 'sent', 'queued', 'sending', 'bounced', 'complained', 'failed', 'canceled'] as const).map((value) => ({
  value,
  label: EMAIL_STATUS[value].label,
  dot: EMAIL_STATUS[value].dot,
}))

const rangeOptions: FilterOption<Range>[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const queryValue = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : null)

function setQuery(key: string, value: string | null) {
  const next: LocationQueryRaw = { ...route.query }
  if (value) next[key] = value
  else delete next[key]
  router.replace({ query: next })
}

const status = computed({
  get: () => {
    const value = queryValue('status')
    return value && (emailStatuses as readonly string[]).includes(value) ? (value as EmailStatus) : null
  },
  set: (value: EmailStatus | null) => setQuery('status', value),
})

const range = computed({
  get: () => {
    const value = queryValue('range')
    return value && value in RANGE_HOURS ? (value as Range) : null
  },
  set: (value: Range | null) => setQuery('range', value),
})

const search = computed({
  get: () => queryValue('search') ?? '',
  set: (value: string) => setQuery('search', value || null),
})

const filtered = computed(() => Boolean(status.value || range.value || search.value))
const filters = computed(() => ({ status: status.value, range: range.value, search: search.value, limit: pageSize.value }))
const pages = useCursorPages(() => [organizationId.value, filters.value])

const query = useQuery({
  queryKey: computed(() => emailsQueryKey(organizationId.value, { ...filters.value, before: pages.cursor.value })),
  queryFn: () =>
    listEmails(organizationId.value, {
      ...filters.value,
      since: range.value ? new Date(Date.now() - RANGE_HOURS[range.value] * 3_600_000).toISOString() : null,
      before: pages.cursor.value,
    }),
  placeholderData: keepPreviousData,
  refetchInterval: (state) => {
    if (pages.page.value > 1) return false
    return (state.state.data?.data ?? []).some((email) => isInFlight(email.status) || email.status === 'sent') ? 5_000 : 30_000
  },
})

const emails = computed(() => query.data.value?.data ?? [])
const live = computed(() => pages.page.value === 1 && emails.value.some((email) => isInFlight(email.status) || email.status === 'sent'))

function recipients(to: string[]) {
  return to.length > 1 ? `${to[0]} +${to.length - 1}` : (to[0] ?? '')
}

function clearFilters() {
  const { status: _status, range: _range, search: _search, ...rest } = route.query
  router.replace({ query: rest })
}

const emailRoute = (email: EmailSummary) => ({ name: 'email', params: { organizationId: organizationId.value, emailId: email.id } })
</script>

<template>
  <div>
    <PageHeader eyebrow="Emails" title="Sent emails">
      <template v-if="live" #actions>
        <span class="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
          <span aria-hidden="true" class="size-1.5 animate-pulse rounded-full bg-status-active motion-reduce:animate-none" />live
        </span>
      </template>
    </PageHeader>

    <LoadErrorCard v-if="query.isError.value && !query.data.value" class="mt-6" :error="query.error.value" subject="emails" @retry="query.refetch()" />

    <DataTable
      v-else
      class="mt-6"
      label="Emails"
      :columns="columns"
      :rows="emails"
      :row-key="(email) => email.id"
      :row-to="emailRoute"
      :row-label="(email) => `${email.subject}, ${EMAIL_STATUS[email.status].label}`"
      :loading="query.isPending.value"
      :refreshing="query.isPlaceholderData.value"
      :skeleton-rows="10"
    >
      <template #toolbar>
        <div class="w-full min-w-0 sm:w-auto sm:flex-1">
          <TableSearch v-model="search" label="Search emails" placeholder="Search subject or recipient" />
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button v-if="filtered" type="button" class="h-8 rounded-sm px-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950" @click="clearFilters">Clear</button>
          <TableFilter v-model="status" label="Status" any-label="Any status" :options="statusOptions" />
          <TableFilter v-model="range" label="Date" any-label="Any time" :options="rangeOptions" />
        </div>
      </template>

      <template #cell-status="{ row }"><EmailStatusBadge :status="row.status" compact /></template>
      <template #cell-email="{ row }">
        <span class="block truncate font-medium text-slate-900">{{ row.subject }}</span>
        <span class="block truncate text-xs text-slate-500">
          to {{ recipients(row.to) }}<span v-if="row.status === 'failed' && row.lastError" class="text-red-600"> · {{ shortFailureReason(row.lastError) }}</span><span class="sm:hidden"> · {{ formatRelativeTime(row.createdAt, now.getTime()) }}</span>
        </span>
      </template>
      <template #cell-from="{ row }"><span class="block truncate text-slate-600" :title="row.from">{{ row.from }}</span></template>
      <template #cell-created="{ row }"><AuditStamp :at="row.createdAt" :by="row.createdBy" /></template>

      <template #empty>
        <p class="m-0 text-sm font-medium text-slate-900">{{ filtered ? 'No emails match' : 'No emails yet' }}</p>
        <p class="m-0 mt-1 text-sm text-slate-500">{{ filtered ? 'Try another filter.' : 'Emails show up here as soon as they’re queued.' }}</p>
        <button v-if="filtered" type="button" class="mt-4 h-8 rounded-sm px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" @click="clearFilters">Clear filters</button>
        <RouterLink v-else :to="{ name: 'playground', params: { organizationId } }" class="mt-4 inline-flex h-8 items-center rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900">Send a test email</RouterLink>
      </template>

      <template v-if="emails.length || pages.page.value > 1" #footer>
        <TablePagination
          noun="emails"
          :page="pages.page.value"
          :page-size="pageSize"
          :row-count="emails.length"
          :has-next="query.data.value?.hasMore ?? false"
          @previous="pages.previous()"
          @next="pages.next(emails.at(-1)?.id)"
          @update:page-size="pageSize = $event"
        />
      </template>
    </DataTable>
  </div>
</template>
