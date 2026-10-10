<script setup lang="ts">
import { Send } from '@iconoir/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { describeLoadError } from '../../../lib/api/describe-error'
import { getMe, meQueryKey } from '../../auth'
import { useCurrentOrganization } from '../../organizations'
import { getOverview, overviewQueryKey, type Overview } from '../api/get-overview'
import { sendTestEmail } from '../api/send-test-email'
import AttentionList from '../components/AttentionList.vue'
import DomainsPanel from '../components/DomainsPanel.vue'
import FirstSendBanner from '../components/FirstSendBanner.vue'
import HealthStrip from '../components/HealthStrip.vue'
import OverviewHeader from '../components/OverviewHeader.vue'
import RecentEmails from '../components/RecentEmails.vue'
import SetupGuide from '../components/SetupGuide.vue'
import { isInFlight } from '../lib/email-status'
import { setupSteps } from '../lib/setup'

const queryClient = useQueryClient()
const { organizationId, organization, canManage } = useCurrentOrganization()
const { data: me } = useQuery({ queryKey: meQueryKey, queryFn: getMe })

function pollInterval(overview: Overview | undefined) {
  if (!overview) return false
  if (overview.recentEmails.some((email) => isInFlight(email.status) || email.status === 'sent')) return 5_000
  if (overview.domains.some((domain) => domain.status === 'pending')) return 15_000
  return 60_000
}

const { data: overview, isPending, isError, error, refetch } = useQuery({
  queryKey: computed(() => overviewQueryKey(organizationId.value)),
  queryFn: () => getOverview(organizationId.value),
  refetchInterval: (query) => pollInterval(query.state.data),
})

const live = computed(() => pollInterval(overview.value) === 5_000)
const isSetup = computed(() => overview.value?.health === 'setup')
const sendingDomain = computed(() => overview.value?.domains.find((domain) => domain.status === 'verified')?.name ?? null)

const justFinishedSetup = ref(false)
watch(
  () => overview.value?.health,
  (health, previous) => {
    if (previous === 'setup' && health && health !== 'setup') justFinishedSetup.value = true
  },
)

const stepsDone = computed(() => (overview.value ? setupSteps(overview.value).filter((step) => step.done).length : 0))

const testSentTo = ref<string | null>(null)
const testSentAt = ref<string | null>(null)
const testMutation = useMutation({
  mutationFn: (to: string) => {
    testSentTo.value = to
    return sendTestEmail(organizationId.value, { from: `test@${sendingDomain.value}`, to })
  },
  async onSuccess() {
    testSentAt.value = new Date().toISOString()
    await queryClient.invalidateQueries({ queryKey: overviewQueryKey(organizationId.value) })
  },
})
const testError = computed(() => {
  const failure = testMutation.error.value
  return failure ? failure.message || 'Couldn’t send the test email. Please try again.' : ''
})
const canSendTest = computed(() => !!sendingDomain.value && !!me.value && !!overview.value?.setup.provider.connected)

const loadError = computed(() => (isError.value ? describeLoadError(error.value, 'the overview') : null))
</script>

<template>
  <div>
    <OverviewHeader :organization-name="organization?.name ?? 'Overview'" :overview="overview ?? null" :steps-done="stepsDone" :steps-total="4">
      <template #action>
        <div v-if="overview && !isSetup && canSendTest" class="flex flex-col items-end gap-1">
          <UButton
            type="button"
            size="md"
            :loading="testMutation.isPending.value"
            class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900"
            @click="testMutation.mutate(me!.email)"
          >
            <Send v-if="!testMutation.isPending.value" aria-hidden="true" class="size-4" />Send test email
          </UButton>
          <span v-if="testSentAt" role="status" class="text-xs text-slate-500">Sent to {{ testSentTo }}</span>
          <span v-else-if="testError" role="alert" class="text-xs text-red-600">{{ testError }}</span>
        </div>
      </template>
    </OverviewHeader>

    <div v-if="isPending" class="mt-8 grid gap-6" aria-busy="true" aria-label="Loading the overview">
      <div class="skeleton-card h-28 rounded-md ring-1 ring-slate-200" />
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="skeleton-card h-80 rounded-md ring-1 ring-slate-200" />
        <div class="skeleton-card h-48 rounded-md ring-1 ring-slate-200 max-lg:hidden" />
      </div>
    </div>

    <div v-else-if="loadError" role="alert" class="mt-8 rounded-md bg-white px-5 py-6 ring-1 ring-slate-200">
      <p class="m-0 text-sm font-semibold text-slate-900">{{ loadError.title }}</p>
      <p class="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{{ loadError.body }}</p>
      <div class="mt-4 flex items-center gap-4">
        <button type="button" class="h-8 rounded-sm bg-atlair-950 px-3 text-sm font-medium text-canvas hover:bg-atlair-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950" @click="refetch()">Try again</button>
        <span class="font-mono text-[11px] text-slate-500">{{ loadError.detail }}</span>
      </div>
    </div>

    <template v-else-if="overview">
      <SetupGuide
        v-if="isSetup"
        class="mt-8"
        :organization-id="organizationId"
        :overview="overview"
        :can-manage="canManage"
        :sending-domain="sendingDomain"
        :recipient="me?.email ?? null"
        :sending-test="testMutation.isPending.value"
        :test-sent-to="testSentTo"
        :test-error="testError"
        @send-test="testMutation.mutate($event)"
      />
      <template v-else>
        <FirstSendBanner v-if="justFinishedSetup" class="mt-8" @dismiss="justFinishedSetup = false" />
        <HealthStrip :overview="overview" class="mt-8" />
      </template>

      <AttentionList v-if="overview.attention.length" :items="overview.attention" :organization-id="organizationId" class="mt-8" />

      <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <RecentEmails :emails="overview.recentEmails" :organization-id="organizationId" :live="live" />
        <DomainsPanel :overview="overview" :organization-id="organizationId" />
      </div>
    </template>
  </div>
</template>
