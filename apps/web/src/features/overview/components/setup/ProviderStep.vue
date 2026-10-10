<script setup lang="ts">
import { NavArrowDown } from '@iconoir/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import CopyButton from '../../../../components/shared/CopyButton.vue'
import type { Overview } from '../../api/get-overview'
import { overviewQueryKey } from '../../api/get-overview'
import { connectSes, turnOnDeliveryEvents, type ProviderAccount } from '../../api/provider'
import { sesIamPolicy } from '../../lib/ses-policy'

const props = defineProps<{ organizationId: string; overview: Overview }>()

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'sa-east-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1', 'eu-south-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'me-south-1', 'il-central-1', 'af-south-1',
]

const queryClient = useQueryClient()
const provider = computed(() => props.overview.setup.provider)
const editing = ref(false)
const showPolicy = ref(false)

const region = ref(provider.value.region ?? 'us-east-1')
const accessKeyId = ref('')
const secretAccessKey = ref('')
const account = ref<ProviderAccount | null>(null)

const refresh = () => queryClient.invalidateQueries({ queryKey: overviewQueryKey(props.organizationId) })

const connect = useMutation({
  mutationFn: () => connectSes(props.organizationId, { region: region.value, accessKeyId: accessKeyId.value.trim(), secretAccessKey: secretAccessKey.value.trim() }),
  async onSuccess(connection) {
    account.value = connection.account ?? null
    secretAccessKey.value = ''
    editing.value = false
    await refresh()
  },
})

const events = useMutation({
  mutationFn: () => turnOnDeliveryEvents(props.organizationId),
  onSuccess: refresh,
})

const canSubmit = computed(() => /^[A-Z0-9]{16,128}$/.test(accessKeyId.value.trim()) && secretAccessKey.value.trim() !== '')
const showForm = computed(() => !provider.value.connected || editing.value)
const consoleUrl = computed(() => `https://${provider.value.region ?? region.value}.console.aws.amazon.com/ses/home?region=${provider.value.region ?? region.value}#/account`)

function submit() {
  if (canSubmit.value && !connect.isPending.value) connect.mutate()
}
</script>

<template>
  <div class="grid gap-4">
    <form v-if="showForm" class="grid gap-4" novalidate @submit.prevent="submit">
      <ol class="m-0 grid list-decimal gap-1 pl-4 text-sm leading-relaxed text-slate-600 marker:text-slate-400">
        <li>In the AWS console, open IAM and create a user for Atlair Mail.</li>
        <li>
          Attach a policy with the permissions it needs.
          <button type="button" class="ml-1 inline-flex items-center gap-1 rounded-sm font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800 focus-visible:outline-2 focus-visible:outline-atlair-950" :aria-expanded="showPolicy" @click="showPolicy = !showPolicy">
            {{ showPolicy ? 'Hide policy' : 'Show policy' }}<NavArrowDown aria-hidden="true" class="size-3.5 transition-transform" :class="showPolicy ? 'rotate-180' : ''" />
          </button>
        </li>
        <li>Create an access key for that user and paste it below.</li>
      </ol>

      <div v-if="showPolicy" class="relative overflow-hidden rounded-md bg-[#14171a] ring-1 ring-black/20">
        <pre class="m-0 max-h-72 overflow-auto p-4 pr-24 font-mono text-[11.5px] leading-relaxed text-[#d6dbe0]"><code>{{ sesIamPolicy }}</code></pre>
        <CopyButton :value="sesIamPolicy" tone="dark" class="absolute right-2 top-2" />
      </div>

      <div class="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label for="ses-region" class="block text-xs font-medium text-slate-700">Region</label>
          <USelect id="ses-region" v-model="region" :items="regions" size="lg" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="connect.isPending.value" />
        </div>
        <div>
          <label for="ses-access-key" class="block text-xs font-medium text-slate-700">Access key ID</label>
          <UInput id="ses-access-key" v-model="accessKeyId" size="lg" autocomplete="off" spellcheck="false" placeholder="AKIA…" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="connect.isPending.value" />
        </div>
        <div>
          <label for="ses-secret" class="block text-xs font-medium text-slate-700">Secret access key</label>
          <UInput id="ses-secret" v-model="secretAccessKey" type="password" size="lg" autocomplete="off" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="connect.isPending.value" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton type="submit" size="md" :loading="connect.isPending.value" :disabled="!canSubmit" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">
          {{ connect.isPending.value ? 'Checking with AWS…' : 'Connect SES' }}
        </UButton>
        <button v-if="editing" type="button" class="rounded-sm px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" @click="editing = false">Cancel</button>
        <p class="m-0 text-xs text-slate-500">The key is checked with AWS, then stored encrypted. It’s never shown again.</p>
      </div>
      <p v-if="connect.error.value" role="alert" class="m-0 text-sm text-red-600">{{ connect.error.value.message }}</p>
    </form>

    <template v-else>
      <div v-if="account?.sandbox" class="rounded-md bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200">
        <p class="m-0 font-medium text-slate-900">Your SES account is in the sandbox</p>
        <p class="m-0 mt-1 leading-relaxed text-slate-600">
          It can only send to addresses verified in SES, up to {{ account.dailyQuota }} a day. Testing works now; for real recipients,
          <a :href="consoleUrl" target="_blank" rel="noopener" class="font-medium text-slate-800 underline decoration-slate-300 underline-offset-4">request production access</a>.
        </p>
      </div>

      <div v-if="!provider.eventsConnected" class="rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
        <p class="m-0 text-sm font-medium text-slate-900">Turn on delivery tracking</p>
        <p class="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          See which emails were delivered, bounced or marked as spam, and stop sending to addresses that bounce. Atlair Mail creates an SNS topic and an SQS queue in your AWS account and reads events from it; no public address needed.
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <UButton type="button" size="md" :loading="events.isPending.value" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="events.mutate()">
            Turn on tracking
          </UButton>
          <p v-if="events.error.value" role="alert" class="m-0 text-sm text-red-600">{{ events.error.value.message }}</p>
        </div>
      </div>
      <p v-else class="m-0 text-sm text-slate-600">Delivery tracking is on: deliveries, bounces and complaints update each email automatically.</p>

      <p class="m-0 text-xs text-slate-500">
        Sending through <span class="font-mono text-slate-700">{{ provider.region }}</span>.
        <button type="button" class="rounded-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900" @click="editing = true">Use different credentials</button>
      </p>
    </template>
  </div>
</template>
