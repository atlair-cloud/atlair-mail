<script setup lang="ts">
import { NavArrowDown } from '@iconoir/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import CopyButton from '../../../components/shared/CopyButton.vue'
import { ApiError } from '../../../lib/api/client'
import { connectSes, type ProviderConnection } from '../api/provider'
import { sesIamPolicy } from '../lib/ses-policy'

const props = withDefaults(defineProps<{ organizationId: string; initialRegion?: string | null; cancellable?: boolean }>(), { initialRegion: null, cancellable: false })
const emit = defineEmits<{ connected: [connection: ProviderConnection]; cancel: [] }>()

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'sa-east-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1', 'eu-south-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'me-south-1', 'il-central-1', 'af-south-1',
]

const queryClient = useQueryClient()
const showPolicy = ref(false)
const region = ref(props.initialRegion ?? 'us-east-1')
const accessKeyId = ref('')
const secretAccessKey = ref('')

const connect = useMutation({
  mutationFn: () => connectSes(props.organizationId, { region: region.value, accessKeyId: accessKeyId.value.trim(), secretAccessKey: secretAccessKey.value.trim() }),
  async onSuccess(connection) {
    secretAccessKey.value = ''
    await queryClient.invalidateQueries({ queryKey: ['organizations', props.organizationId] })
    emit('connected', connection)
  },
})

const connectError = computed(() => {
  const error = connect.error.value
  if (!error) return null
  return error instanceof ApiError && error.code === 'ATL_PROVIDER_ACCOUNT_IN_USE' ? 'This AWS account is already used by another organization.' : error.message
})

const canSubmit = computed(() => /^[A-Z0-9]{16,128}$/.test(accessKeyId.value.trim()) && secretAccessKey.value.trim() !== '')

function submit() {
  if (canSubmit.value && !connect.isPending.value) connect.mutate()
}
</script>

<template>
  <form class="grid gap-4" novalidate @submit.prevent="submit">
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
      <button v-if="cancellable" type="button" class="rounded-sm px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" @click="emit('cancel')">Cancel</button>
      <p class="m-0 text-xs text-slate-500">The key is checked with AWS, then stored encrypted. It’s never shown again.</p>
    </div>
    <p v-if="connectError" role="alert" class="m-0 text-sm text-red-600">{{ connectError }}</p>
  </form>
</template>
