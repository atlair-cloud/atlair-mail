<script setup lang="ts">
import { Mail, NavArrowRight } from '@iconoir/vue'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { routeIfExists } from '../../../lib/links'
import { EMAIL_STATUS, shortFailureReason, type EmailSummary } from '../../emails'

const props = defineProps<{ emails: EmailSummary[]; organizationId: string; live: boolean; sandbox: boolean }>()

const router = useRouter()
const now = useNow({ interval: 15_000 })
const allEmails = computed(() => routeIfExists(router, 'emails', { organizationId: props.organizationId }))

function recipients(to: string[]) {
  return to.length > 1 ? `${to[0]} +${to.length - 1}` : (to[0] ?? '')
}

const sameAs = (a: EmailSummary, b: EmailSummary) =>
  a.status === b.status && a.subject === b.subject && a.lastError === b.lastError && a.to.join() === b.to.join()

const rows = computed(() => {
  const grouped: { email: EmailSummary; count: number; oldest: string }[] = []
  for (const email of props.emails) {
    const last = grouped.at(-1)
    if (last && sameAs(last.email, email)) {
      last.count += 1
      last.oldest = email.createdAt
    } else {
      grouped.push({ email, count: 1, oldest: email.createdAt })
    }
  }
  return grouped
})

function emailRoute(id: string) {
  return routeIfExists(router, 'email', { organizationId: props.organizationId, emailId: id })
}
</script>

<template>
  <section aria-labelledby="recent-heading" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
      <div class="flex items-center gap-2.5">
        <h2 id="recent-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Recent emails</h2>
        <span v-if="live" class="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
          <span aria-hidden="true" class="size-1.5 animate-pulse rounded-full bg-status-active motion-reduce:animate-none" />live
        </span>
      </div>
      <RouterLink v-if="allEmails" :to="allEmails" class="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950">
        All emails<NavArrowRight aria-hidden="true" class="size-3" />
      </RouterLink>
    </header>

    <div v-if="emails.length === 0" class="flex flex-col items-center px-6 py-12 text-center">
      <span aria-hidden="true" class="flex size-10 items-center justify-center rounded-sm bg-slate-100 text-slate-500"><Mail class="size-5" /></span>
      <p class="m-0 mt-3 text-sm font-medium text-slate-900">No emails yet</p>
      <p class="m-0 mt-1 max-w-72 text-sm text-slate-500">Each email shows up here the moment it’s queued, then updates as it’s delivered.</p>
    </div>

    <ol v-else class="m-0 list-none divide-y divide-slate-100 p-0">
      <li v-for="{ email, count, oldest } in rows" :key="email.id" class="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 hover:bg-slate-50 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]">
        <span class="inline-flex items-center gap-2 text-xs font-medium" :class="EMAIL_STATUS[email.status].text">
          <span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="EMAIL_STATUS[email.status].dot" /><span class="max-sm:sr-only">{{ EMAIL_STATUS[email.status].label }}</span>
        </span>
        <div class="min-w-0">
          <p class="m-0 flex min-w-0 items-center gap-2 text-sm">
            <span class="min-w-0 truncate">
              <RouterLink
                v-if="emailRoute(email.id)"
                :to="emailRoute(email.id)!"
                class="font-medium text-slate-900 outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-atlair-950"
              >{{ email.subject }}</RouterLink>
              <span v-else class="font-medium text-slate-900">{{ email.subject }}</span>
              <span class="text-slate-500"> to {{ recipients(email.to) }}</span>
            </span>
            <span v-if="count > 1" class="shrink-0 rounded-sm bg-slate-100 px-1.5 font-mono text-[11px] font-medium text-slate-600" :title="`${count} identical emails, the oldest ${formatRelativeTime(oldest, now.getTime())}`">×{{ count }}</span>
          </p>
          <p v-if="email.status === 'failed'" class="m-0 mt-0.5 truncate text-xs text-red-700">{{ shortFailureReason(email.lastError, sandbox) }}</p>
        </div>
        <time :datetime="email.createdAt" class="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(email.createdAt, now.getTime()) }}</time>
      </li>
    </ol>
  </section>
</template>
