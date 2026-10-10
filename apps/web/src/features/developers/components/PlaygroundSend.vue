<script setup lang="ts">
import { NavArrowRight } from '@iconoir/vue'
import { useQuery } from '@tanstack/vue-query'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { EMAIL_STATUS, emailQueryKey, getEmail, isInFlight, shortFailureReason } from '../../emails'

const props = defineProps<{ organizationId: string; emailId: string; to: string[]; subject: string; sentAt: string; tracking: boolean; sandbox: boolean }>()

const now = useNow({ interval: 5_000 })
const { data: email } = useQuery({
  queryKey: computed(() => emailQueryKey(props.organizationId, props.emailId)),
  queryFn: () => getEmail(props.organizationId, props.emailId),
  refetchInterval: (query) => {
    const status = query.state.data?.status
    const waiting = !status || isInFlight(status) || (status === 'sent' && props.tracking)
    return waiting && Date.now() - new Date(props.sentAt).getTime() < 3 * 60_000 ? 2_000 : false
  },
})
const status = computed(() => email.value?.status ?? 'queued')
</script>

<template>
  <li class="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 hover:bg-slate-50">
    <div class="min-w-0">
      <p class="m-0 flex min-w-0 items-center gap-2 text-sm">
        <span class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium" :class="EMAIL_STATUS[status].text" aria-live="polite">
          <span aria-hidden="true" class="size-2 rounded-full" :class="[EMAIL_STATUS[status].dot, isInFlight(status) && 'animate-pulse motion-reduce:animate-none']" />{{ EMAIL_STATUS[status].label }}
        </span>
        <RouterLink
          :to="{ name: 'email', params: { organizationId, emailId } }"
          class="min-w-0 truncate font-medium text-slate-900 outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-atlair-950"
        >{{ subject }}</RouterLink>
        <span class="min-w-0 truncate text-slate-500">to {{ to.join(', ') }}</span>
      </p>
      <p v-if="status === 'failed'" class="m-0 mt-0.5 truncate text-xs text-red-700">{{ shortFailureReason(email?.lastError, sandbox) }}</p>
      <p v-else-if="status === 'sent' && !tracking" class="m-0 mt-0.5 text-xs text-slate-500">Accepted by SES. Turn on delivery tracking to see what happens next.</p>
    </div>
    <span class="flex items-center gap-1 font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(sentAt, now.getTime()) }}<NavArrowRight aria-hidden="true" class="size-3" /></span>
  </li>
</template>
