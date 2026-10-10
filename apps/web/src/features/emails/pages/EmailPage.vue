<script setup lang="ts">
import { NavArrowLeft, WarningCircle } from '@iconoir/vue'
import { useQuery } from '@tanstack/vue-query'
import { useNow } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ActorName from '../../../components/shared/ActorName.vue'
import CopyButton from '../../../components/shared/CopyButton.vue'
import NotFound from '../../../components/shared/NotFound.vue'
import { ApiError } from '../../../lib/api/client'
import { describeLoadError } from '../../../lib/api/describe-error'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { deliveryTrackingQueryKey, emailEventsQueryKey, emailQueryKey, getDeliveryTracking, getEmail, listEmailEvents } from '../api/emails'
import EmailStatusBadge from '../components/EmailStatusBadge.vue'
import { isInFlight } from '../lib/email-status'
import { buildTimeline, explainFailure, type TimelineTone } from '../lib/timeline'

const route = useRoute()
const now = useNow({ interval: 15_000 })
const organizationId = computed(() => String(route.params.organizationId))
const emailId = computed(() => String(route.params.emailId))

const awaitingOutcome = (status: string | undefined) => !!status && (isInFlight(status as never) || status === 'sent')

const emailQuery = useQuery({
  queryKey: computed(() => emailQueryKey(organizationId.value, emailId.value)),
  queryFn: () => getEmail(organizationId.value, emailId.value),
  refetchInterval: (query) => (awaitingOutcome(query.state.data?.status) ? 4_000 : false),
})
const email = computed(() => emailQuery.data.value)

const eventsQuery = useQuery({
  queryKey: computed(() => emailEventsQueryKey(organizationId.value, emailId.value)),
  queryFn: () => listEmailEvents(organizationId.value, emailId.value),
  enabled: computed(() => !!email.value),
  refetchInterval: () => (awaitingOutcome(email.value?.status) ? 4_000 : false),
})

const { data: trackingOn } = useQuery({
  queryKey: computed(() => deliveryTrackingQueryKey(organizationId.value)),
  queryFn: () => getDeliveryTracking(organizationId.value),
  staleTime: 60_000,
})

const timeline = computed(() => (email.value ? buildTimeline(email.value, eventsQuery.data.value ?? [], trackingOn.value ?? false) : []))

const notFound = computed(() => emailQuery.error.value instanceof ApiError && emailQuery.error.value.status === 404)
const loadError = computed(() => (emailQuery.isError.value && !notFound.value ? describeLoadError(emailQuery.error.value, 'this email') : null))

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
const formatAbsolute = (value: string) => absolute.format(new Date(value))

const toneDot: Record<TimelineTone, string> = {
  neutral: 'bg-slate-300',
  active: 'bg-status-active',
  good: 'bg-status-live',
  warning: 'bg-status-attention',
  bad: 'bg-red-500',
}

type BodyTab = 'html' | 'text' | 'headers'
const tab = ref<BodyTab | null>(null)
const activeTab = computed<BodyTab>(() => tab.value ?? (email.value?.html ? 'html' : 'text'))
const bodyTabs = computed(() =>
  [
    { value: 'html' as const, label: 'Preview', show: !!email.value?.html },
    { value: 'text' as const, label: 'Plain text', show: !!email.value?.text },
    { value: 'headers' as const, label: 'Headers', show: true },
  ].filter((item) => item.show),
)

const people = computed(() => {
  const value = email.value
  if (!value) return []
  return [
    { label: 'From', values: [value.from] },
    { label: 'To', values: value.to },
    { label: 'Cc', values: value.cc },
    { label: 'Bcc', values: value.bcc },
    { label: 'Reply-To', values: value.replyTo },
  ].filter((row) => row.values.length > 0)
})
</script>

<template>
  <div>
    <RouterLink
      :to="{ name: 'emails', params: { organizationId } }"
      class="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950"
    >
      <NavArrowLeft aria-hidden="true" class="size-4" />All emails
    </RouterLink>

    <div v-if="emailQuery.isPending.value" class="mt-6 grid gap-6" aria-busy="true" aria-label="Loading the email">
      <div class="skeleton h-8 w-96 max-w-full rounded-sm" />
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="skeleton-card h-96 rounded-md ring-1 ring-slate-200" />
        <div class="skeleton-card h-64 rounded-md ring-1 ring-slate-200" />
      </div>
    </div>

    <NotFound
      v-else-if="notFound"
      title="We couldn’t find that email"
      body="It may belong to another organization, or the link is wrong."
      :to="{ name: 'emails', params: { organizationId } }"
      to-label="Go to all emails"
    />

    <div v-else-if="loadError" role="alert" class="mt-6 rounded-md bg-white px-5 py-6 ring-1 ring-slate-200">
      <p class="m-0 text-sm font-semibold text-slate-900">{{ loadError.title }}</p>
      <p class="m-0 mt-1 text-sm text-slate-600">{{ loadError.body }}</p>
      <button type="button" class="mt-4 h-8 rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900" @click="emailQuery.refetch()">Try again</button>
    </div>

    <template v-else-if="email">
      <header class="mt-5">
        <EmailStatusBadge :status="email.status" />
        <h1 tabindex="-1" class="m-0 mt-2 break-words text-[26px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ email.subject }}</h1>
        <p class="mb-0 mt-2 text-sm text-slate-600">
          From <span class="font-medium text-slate-800">{{ email.from }}</span> to
          <span class="font-medium text-slate-800">{{ email.to.join(', ') }}</span>
          <template v-if="email.createdBy"> · sent by <ActorName :actor="email.createdBy" class="font-medium text-slate-800" /></template>
          · <time :datetime="email.createdAt" :title="formatAbsolute(email.createdAt)">{{ formatRelativeTime(email.createdAt, now.getTime()) }}</time>
        </p>
      </header>

      <div v-if="email.status === 'failed' && email.lastError" role="alert" class="mt-6 flex items-start gap-3 rounded-md bg-red-50 px-4 py-3 ring-1 ring-red-200">
        <WarningCircle aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-red-600" />
        <div class="min-w-0">
          <p class="m-0 text-sm font-medium text-slate-900">This email wasn’t sent</p>
          <p class="m-0 mt-0.5 break-words text-sm text-slate-600">{{ explainFailure(email.lastError) }}</p>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="grid min-w-0 content-start gap-6">
          <section aria-labelledby="timeline-heading" class="rounded-md bg-white px-5 py-4 ring-1 ring-slate-200">
            <h2 id="timeline-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">What happened</h2>
            <ol class="m-0 mt-4 list-none p-0">
              <li v-for="(entry, index) in timeline" :key="entry.key" class="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
                <span v-if="index < timeline.length - 1" aria-hidden="true" class="absolute bottom-0 left-[7px] top-4 w-px" :class="timeline[index + 1]?.pending ? 'border-l border-dashed border-slate-300' : 'bg-slate-200'" />
                <span aria-hidden="true" class="relative mt-1 flex size-[15px] items-center justify-center rounded-full bg-white ring-4 ring-white">
                  <span class="size-2.5 rounded-full" :class="[toneDot[entry.tone], entry.pending ? 'animate-pulse motion-reduce:animate-none' : '']" />
                </span>
                <div class="min-w-0">
                  <p class="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span class="font-medium" :class="entry.pending ? 'text-slate-600' : 'text-slate-900'">{{ entry.title }}</span>
                    <time v-if="entry.at" :datetime="entry.at" :title="formatAbsolute(entry.at)" class="font-mono text-[11px] tabular-nums text-slate-500">{{ formatAbsolute(entry.at) }}</time>
                  </p>
                  <p v-if="entry.detail" class="m-0 mt-0.5 break-words text-sm leading-relaxed text-slate-600">{{ entry.detail }}</p>
                  <ul v-if="entry.recipients?.length" class="m-0 mt-1.5 grid list-none gap-1 p-0">
                    <li v-for="recipient in entry.recipients" :key="recipient.address" class="text-xs text-slate-600">
                      <span class="font-medium text-slate-800">{{ recipient.address }}</span>
                      <code v-if="recipient.diagnosticCode" class="ml-2 break-all font-mono text-[11px] text-slate-500">{{ recipient.diagnosticCode }}</code>
                    </li>
                  </ul>
                </div>
              </li>
            </ol>
          </section>

          <section aria-labelledby="content-heading" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
            <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
              <h2 id="content-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Content</h2>
              <div role="tablist" aria-label="Email content" class="flex gap-1">
                <button
                  v-for="item in bodyTabs"
                  :key="item.value"
                  type="button"
                  role="tab"
                  :aria-selected="activeTab === item.value"
                  class="rounded-sm px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-atlair-950"
                  :class="activeTab === item.value ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'"
                  @click="tab = item.value"
                >{{ item.label }}</button>
              </div>
            </header>
            <iframe
              v-if="activeTab === 'html' && email.html"
              :srcdoc="email.html"
              sandbox=""
              referrerpolicy="no-referrer"
              title="Email preview"
              class="block h-[32rem] w-full resize-y bg-white [color-scheme:light]"
            />
            <pre v-else-if="activeTab === 'text'" class="m-0 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800">{{ email.text }}</pre>
            <dl v-else class="m-0 grid max-h-[32rem] gap-2 overflow-auto p-4 text-xs">
              <div v-if="Object.keys(email.headers).length === 0" class="text-slate-500">No custom headers.</div>
              <div v-for="(value, name) in email.headers" :key="name" class="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-3">
                <dt class="truncate font-mono text-slate-500">{{ name }}</dt>
                <dd class="m-0 break-all font-mono text-slate-800">{{ value }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside class="grid min-w-0 content-start gap-4">
          <section aria-labelledby="people-heading" class="min-w-0 rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
            <h2 id="people-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Addresses</h2>
            <dl class="m-0 mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 text-sm">
              <div v-for="row in people" :key="row.label">
                <dt class="text-xs text-slate-500">{{ row.label }}</dt>
                <dd v-for="address in row.values" :key="address" class="m-0 break-all text-slate-800">{{ address }}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="details-heading" class="min-w-0 rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
            <h2 id="details-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Details</h2>
            <dl class="m-0 mt-2 grid grid-cols-[minmax(0,1fr)] gap-2.5 text-sm">
              <div>
                <dt class="text-xs text-slate-500">Email ID</dt>
                <dd class="m-0 flex items-center justify-between gap-2"><code class="min-w-0 truncate font-mono text-xs text-slate-800">{{ email.id }}</code><CopyButton :value="email.id" /></dd>
              </div>
              <div v-if="email.providerMessageId">
                <dt class="text-xs text-slate-500">SES message ID</dt>
                <dd class="m-0 flex items-center justify-between gap-2"><code class="min-w-0 truncate font-mono text-xs text-slate-800">{{ email.providerMessageId }}</code><CopyButton :value="email.providerMessageId" /></dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Created</dt>
                <dd class="m-0 text-slate-800">{{ formatAbsolute(email.createdAt) }}</dd>
                <dd class="m-0 mt-0.5 text-xs text-slate-600"><span class="sr-only">by </span><ActorName :actor="email.createdBy" fallback="Unknown sender" /></dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Last updated</dt>
                <dd class="m-0 text-slate-800">{{ formatAbsolute(email.updatedAt) }}</dd>
                <dd class="m-0 mt-0.5 text-xs text-slate-500">Automatic</dd>
              </div>
              <div v-if="email.sentAt">
                <dt class="text-xs text-slate-500">Sent</dt>
                <dd class="m-0 text-slate-800">{{ formatAbsolute(email.sentAt) }}</dd>
              </div>
              <div v-if="email.tags.length">
                <dt class="text-xs text-slate-500">Tags</dt>
                <dd class="m-0 mt-1 flex flex-wrap gap-1.5">
                  <span v-for="tag in email.tags" :key="`${tag.name}=${tag.value}`" class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{{ tag.name }}={{ tag.value }}</span>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
