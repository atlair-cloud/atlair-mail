<script setup lang="ts">
import { computed, ref } from 'vue'
import { ConnectSesForm, DeliveryTrackingCard, SandboxNotice, type ProviderConnection } from '../../../settings'
import type { Overview } from '../../api/get-overview'

const props = defineProps<{ organizationId: string; overview: Overview }>()

const provider = computed(() => props.overview.setup.provider)
const editing = ref(false)
const connection = ref<ProviderConnection | null>(null)

function connected(result: ProviderConnection) {
  connection.value = result
  editing.value = false
}
</script>

<template>
  <div class="grid gap-4">
    <ConnectSesForm v-if="!provider.connected || editing" :organization-id="organizationId" :initial-region="provider.region" :cancellable="editing" @connected="connected" @cancel="editing = false" />
    <template v-else>
      <SandboxNotice v-if="connection?.account" :account="connection.account" :region="connection.region" />
      <DeliveryTrackingCard v-if="!provider.eventsConnected" :organization-id="organizationId" />
      <p v-else class="m-0 text-sm text-slate-600">Delivery tracking is on: deliveries, bounces and complaints update each email automatically.</p>
      <p class="m-0 text-xs text-slate-500">
        Sending through <span class="font-mono text-slate-700">{{ provider.region }}</span>.
        <button type="button" class="rounded-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900" @click="editing = true">Use different credentials</button>
      </p>
    </template>
  </div>
</template>
