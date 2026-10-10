<script setup lang="ts">
import { Mail } from '@iconoir/vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '../../../components/shared/EmptyState.vue'
import { describeLoadError } from '../../../lib/api/describe-error'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { emailPageSize, emailsQueryKey, listEmails } from '../api/emails'
import { emailStatuses, type EmailStatus } from '../api/types'
import EmailStatusBadge from '../components/EmailStatusBadge.vue'
import { EMAIL_STATUS, isInFlight } from '../lib/email-status'

const route = useRoute()
const router = useRouter()
const now = useNow({ interval: 15_000 })
const organizationId = computed(() => String(route.params.organizationId))

const status = computed<EmailStatus | null>(() => {
  const value = route.query.status
  return typeof value === 'string' && (emailStatuses as string[]).includes(value) ? (value as EmailStatus) : null
})

const filters: { value: EmailStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  ...(['delivered', 'sent', 'queued', 'bounced', 'complained', 'failed', 'canceled'] as const).map((value) => ({ value, label: EMAIL_STATUS[value].label })),
]

const query = useInfiniteQuery({
  queryKey: computed(() => emailsQueryKey(organizationId.value, status.value)),
  queryFn: ({ pageParam }) => listEmails(organizationId.value, { status: status.value, before: pageParam }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => (lastPage.length === emailPageSize ? lastPage.at(-1)?.id : undefined),
  refetchInterval: (state) => {
    const firstPage = state.state.data?.pages[0] ?? []
    return firstPage.some((email) => isInFlight(email.status) || email.status === 'sent') ? 5_000 : 30_000
  },
})

const emails = computed(() => query.data.value?.pages.flat() ?? [])
const live = computed(() => (query.data.value?.pages[0] ?? []).some((email) => isInFlight(email.status) || email.status === 'sent'))
const loadError = computed(() => (query.isError.value ? describeLoadError(query.error.value, 'emails') : null))

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

function setStatus(value: EmailStatus | null) {
  const { status: _previous, ...rest } = route.query
  router.replace({ query: value ? { ...rest, status: value } : rest })
}

function recipients(to: string[]) {
  return to.length > 1 ? `${to[0]} +${to.length - 1}` : (to[0] ?? '')
}
</script>

<template>
  <div>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Emails</p>
        <h1 tabindex="-1" class="m-0 mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">Sent from this organization</h1>
        <p class="mb-0 mt-2 text-sm text-slate-600">Newest first. Each email updates as Amazon reports delivery, bounces and complaints.</p>
      </div>
      <span v-if="live" class="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
        <span aria-hidden="true" class="size-1.5 animate-pulse rounded-full bg-status-active motion-reduce:animate-none" />live
      </span>
    </header>

    <nav aria-label="Filter by status" class="mt-6 flex flex-wrap gap-1.5">
      <button
        v-for="filter in filters"
        :key="filter.label"
        type="button"
        class="inline-flex h-8 items-center gap-2 rounded-sm px-3 text-sm font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
        :class="status === filter.value ? 'bg-atlair-950 text-canvas ring-atlair-950' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100 hover:text-slate-900'"
        :aria-pressed="status === filter.value"
        @click="setStatus(filter.value)"
      >
        <span v-if="filter.value" aria-hidden="true" class="size-2 rounded-full" :class="EMAIL_STATUS[filter.value].dot" />{{ filter.label }}
      </button>
    </nav>

    <div v-if="query.isPending.value" class="mt-6 overflow-hidden rounded-md bg-white ring-1 ring-slate-200" aria-busy="true" aria-label="Loading emails">
      <div v-for="n in 8" :key="n" class="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0">
        <div class="skeleton h-3 w-20 rounded-sm" />
        <div class="skeleton h-3 w-72 max-w-full rounded-sm" />
        <div class="skeleton ml-auto h-3 w-16 rounded-sm" />
      </div>
    </div>

    <div v-else-if="loadError" role="alert" class="mt-6 rounded-md bg-white px-5 py-6 ring-1 ring-slate-200">
      <p class="m-0 text-sm font-semibold text-slate-900">{{ loadError.title }}</p>
      <p class="m-0 mt-1 text-sm text-slate-600">{{ loadError.body }}</p>
      <button type="button" class="mt-4 h-8 rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900" @click="query.refetch()">Try again</button>
    </div>

    <EmptyState
      v-else-if="emails.length === 0"
      class="mt-6"
      :title="status ? `No ${EMAIL_STATUS[status].label.toLowerCase()} emails` : 'No emails yet'"
      :description="status ? 'Nothing matches this filter right now.' : 'Send one from your app or from the overview, and it shows up here the moment it’s queued.'"
    >
      <template #icon><Mail class="size-5" /></template>
      <button v-if="status" type="button" class="h-8 rounded-sm px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" @click="setStatus(null)">Show all emails</button>
      <RouterLink v-else :to="{ name: 'organization', params: { organizationId } }" class="inline-flex h-8 items-center rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900">Go to the overview</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="mt-6 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
        <table class="w-full table-fixed border-collapse text-sm">
          <thead class="border-b border-slate-100 text-left">
            <tr class="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
              <th scope="col" class="w-28 px-4 py-2.5 font-medium sm:w-32">Status</th>
              <th scope="col" class="px-4 py-2.5 font-medium">Email</th>
              <th scope="col" class="hidden w-64 px-4 py-2.5 font-medium md:table-cell">From</th>
              <th scope="col" class="hidden w-32 px-4 py-2.5 text-right font-medium sm:table-cell">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="email in emails" :key="email.id" class="relative hover:bg-slate-50">
              <td class="px-4 py-3"><EmailStatusBadge :status="email.status" /></td>
              <td class="min-w-0 px-4 py-3">
                <RouterLink
                  :to="{ name: 'email', params: { organizationId, emailId: email.id } }"
                  class="block truncate font-medium text-slate-900 outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-atlair-950"
                >{{ email.subject }}</RouterLink>
                <span class="block truncate text-xs text-slate-500">to {{ recipients(email.to) }}<span class="sm:hidden"> · {{ formatRelativeTime(email.createdAt, now.getTime()) }}</span></span>
              </td>
              <td class="hidden truncate px-4 py-3 text-slate-600 md:table-cell">{{ email.from }}</td>
              <td class="hidden px-4 py-3 text-right sm:table-cell">
                <time :datetime="email.createdAt" :title="absolute.format(new Date(email.createdAt))" class="font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(email.createdAt, now.getTime()) }}</time>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between gap-4 text-xs text-slate-500">
        <span>{{ emails.length }} {{ emails.length === 1 ? 'email' : 'emails' }} shown</span>
        <UButton
          v-if="query.hasNextPage.value"
          type="button"
          size="sm"
          color="neutral"
          variant="outline"
          :loading="query.isFetchingNextPage.value"
          class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100"
          @click="query.fetchNextPage()"
        >
          Load older emails
        </UButton>
        <span v-else-if="emails.length >= emailPageSize">That’s everything.</span>
      </div>
    </template>
  </div>
</template>
