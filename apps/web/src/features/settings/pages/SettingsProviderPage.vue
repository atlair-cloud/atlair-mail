<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { computed, ref } from 'vue'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import SettingsCard from '../../../components/shared/SettingsCard.vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { useCurrentOrganization } from '../../organizations'
import { disconnectProvider, getProvider, providerQueryKey, redriveEvents, type EventsStatus, type ProviderConnection } from '../api/provider'
import ConnectSesForm from '../components/ConnectSesForm.vue'
import DeliveryTrackingCard from '../components/DeliveryTrackingCard.vue'
import SandboxNotice from '../components/SandboxNotice.vue'

const toast = useToast()
const queryClient = useQueryClient()
const { organizationId, canManage } = useCurrentOrganization()

const query = useQuery({
  queryKey: computed(() => providerQueryKey(organizationId.value)),
  queryFn: () => getProvider(organizationId.value),
  refetchInterval: (state) => (state.state.data?.events.status === 'pending_confirmation' ? 10_000 : false),
})
const provider = computed(() => query.data.value)

const replacing = ref(false)
const latest = ref<ProviderConnection | null>(null)
function connected(connection: ProviderConnection) {
  latest.value = connection
  replacing.value = false
  toast.add({ title: 'Amazon SES connected', description: `Sending through ${connection.region}.`, color: 'neutral' })
}

const EVENTS: Record<EventsStatus, { label: string; dot: string; text: string }> = {
  confirmed: { label: 'On', dot: 'bg-status-live', text: 'Deliveries, bounces and complaints update each email automatically.' },
  pending_confirmation: { label: 'Waiting for AWS', dot: 'bg-status-active', text: 'AWS is confirming the subscription. This usually takes under a minute.' },
  failing: { label: 'Failing', dot: 'bg-red-500', text: 'The worker can’t read events from your queue.' },
  disabled: { label: 'Off', dot: 'bg-slate-300', text: 'Emails stay at “sent”: you won’t see deliveries, bounces or complaints.' },
}

const redrive = useMutation({
  mutationFn: () => redriveEvents(organizationId.value),
  async onSuccess() {
    toast.add({ title: 'Retrying set-aside events', description: 'The worker picks them up as they arrive.', color: 'neutral' })
    await queryClient.invalidateQueries({ queryKey: providerQueryKey(organizationId.value) })
  },
})

const disconnectOpen = ref(false)
const disconnect = useMutation({
  mutationFn: () => disconnectProvider(organizationId.value),
  async onSuccess() {
    disconnectOpen.value = false
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    toast.add({ title: 'Amazon SES disconnected', description: 'Emails can’t be sent until you connect again.', color: 'neutral' })
  },
})
</script>

<template>
  <div v-if="query.isPending.value" class="skeleton-card h-56 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading the provider" />

  <LoadErrorCard v-else-if="query.isError.value" :error="query.error.value" subject="the provider" @retry="query.refetch()" />

  <div v-else-if="!provider || replacing" class="divide-y divide-slate-200">
    <SettingsCard :title="provider ? 'Replace credentials' : 'Connect Amazon SES'" description="Emails go out through your own AWS account, so the sending reputation and the bill stay yours.">
      <ConnectSesForm v-if="canManage" :organization-id="organizationId" :initial-region="provider?.region" :cancellable="replacing" @connected="connected" @cancel="replacing = false" />
      <p v-else class="m-0 text-sm text-slate-600">No provider is connected. An owner or admin can connect Amazon SES.</p>
    </SettingsCard>
  </div>

  <div v-else class="divide-y divide-slate-200">
    <SettingsCard title="Amazon SES" description="The AWS account emails are sent through.">
      <div class="grid gap-4">
        <SandboxNotice v-if="latest?.account" :account="latest.account" :region="provider.region" />
        <dl class="m-0 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <div><dt class="text-xs text-slate-500">Region</dt><dd class="m-0 mt-0.5 font-mono text-slate-900">{{ provider.region }}</dd></div>
          <div><dt class="text-xs text-slate-500">Access key</dt><dd class="m-0 mt-0.5 truncate font-mono text-slate-900">{{ provider.accessKeyId }}</dd></div>
          <div><dt class="text-xs text-slate-500">Connected</dt><dd class="m-0 mt-0.5 text-slate-900">{{ formatRelativeTime(provider.createdAt) }}</dd></div>
        </dl>
      </div>
      <template v-if="canManage" #footer>
        <p class="m-0 text-xs text-slate-500">The secret key is stored encrypted and never shown.</p>
        <UButton type="button" size="md" color="neutral" variant="outline" class="h-9 rounded-sm bg-white px-3.5 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="replacing = true">Replace credentials</UButton>
      </template>
    </SettingsCard>

    <SettingsCard title="Delivery tracking" description="How Atlair Mail learns what happened to each email after SES accepts it.">
      <div class="grid gap-4">
        <p class="m-0 flex items-center gap-2 text-sm" aria-live="polite">
          <span aria-hidden="true" class="size-2 rounded-full" :class="EVENTS[provider.events.status].dot" />
          <span class="font-medium text-slate-900">{{ EVENTS[provider.events.status].label }}</span>
          <span class="text-slate-600">{{ EVENTS[provider.events.status].text }}</span>
        </p>
        <p v-if="provider.events.lastError" role="alert" class="m-0 break-words rounded-sm bg-red-50 px-3 py-2 font-mono text-xs text-red-700 ring-1 ring-red-200">{{ provider.events.lastError }}</p>
        <dl v-if="provider.events.mode" class="m-0 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt class="text-xs text-slate-500">Mode</dt><dd class="m-0 mt-0.5 text-slate-900">{{ provider.events.mode === 'pull' ? 'Queue (pull)' : 'Push' }}</dd></div>
          <div><dt class="text-xs text-slate-500">Last event</dt><dd class="m-0 mt-0.5 text-slate-900">{{ provider.events.lastReceivedAt ? formatRelativeTime(provider.events.lastReceivedAt) : '—' }}</dd></div>
          <div v-if="provider.events.backlog !== null"><dt class="text-xs text-slate-500">Waiting</dt><dd class="m-0 mt-0.5 tabular-nums text-slate-900">{{ provider.events.backlog }}</dd></div>
          <div v-if="provider.events.deadLetters !== null"><dt class="text-xs text-slate-500">Set aside</dt><dd class="m-0 mt-0.5 tabular-nums" :class="provider.events.deadLetters ? 'font-medium text-amber-700' : 'text-slate-900'">{{ provider.events.deadLetters }}</dd></div>
        </dl>
        <DeliveryTrackingCard v-if="canManage && provider.events.status === 'disabled'" :organization-id="organizationId" />
      </div>
      <template v-if="canManage && provider.events.mode === 'pull' && provider.events.deadLetters" #footer>
        <p class="m-0 text-xs text-slate-600">{{ provider.events.deadLetters }} events failed 10 times and were set aside.</p>
        <UButton type="button" size="md" :loading="redrive.isPending.value" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900" @click="redrive.mutate()">Retry them</UButton>
      </template>
    </SettingsCard>

    <SettingsCard v-if="canManage" tone="danger" title="Disconnect" description="Removes the credentials from Atlair Mail. Domains, the SNS topic and the queue stay in your AWS account.">
      <template #footer>
        <p class="m-0 text-xs text-red-800">Emails can’t be sent until you connect again.</p>
        <UButton type="button" size="md" color="neutral" variant="outline" class="h-9 shrink-0 rounded-sm bg-white px-3.5 text-sm font-medium text-red-700 ring-red-200 hover:bg-red-50 hover:ring-red-300" @click="disconnect.reset(); disconnectOpen = true">Disconnect…</UButton>
      </template>
    </SettingsCard>

    <ConfirmModal
      v-model:open="disconnectOpen"
      title="Disconnect Amazon SES?"
      description="Queued emails fail until a provider is connected again."
      action="Disconnect"
      confirm-text="disconnect"
      :pending="disconnect.isPending.value"
      :error="disconnect.error.value?.message"
      @confirm="disconnect.mutate()"
    />
  </div>
</template>
