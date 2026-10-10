<script setup lang="ts">
import { computed } from 'vue'
import CopyButton from '../../../../components/shared/CopyButton.vue'
import { API_URL } from '../../../../lib/api/client'
import type { CreatedApiKey } from '../../api/api-keys'

const props = defineProps<{
  sendingDomain: string | null
  recipient: string | null
  apiKey: CreatedApiKey | null
  sending: boolean
  sentTo: string | null
  error: string
}>()
const emit = defineEmits<{ send: [to: string] }>()

const simulator = 'success@simulator.amazonses.com'

const snippet = computed(() =>
  [
    `curl -X POST ${API_URL}/service/web/emails \\`,
    `  -H "Authorization: Bearer ${props.apiKey?.token ?? '$ATLAIR_MAIL_API_KEY'}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "from": "hello@${props.sendingDomain ?? 'yourdomain.com'}",`,
    `    "to": ["${props.recipient ?? 'you@example.com'}"],`,
    `    "subject": "Hello from Atlair Mail",`,
    `    "text": "It works."`,
    `  }'`,
  ].join('\n'),
)
</script>

<template>
  <div class="grid gap-4">
    <p v-if="apiKey" class="m-0 rounded-md bg-emerald-50 px-4 py-2.5 text-sm text-slate-700 ring-1 ring-emerald-200">
      Your new key “{{ apiKey.name }}” is filled in below. Copy it now: it won’t be shown again.
    </p>
    <div class="relative overflow-hidden rounded-md bg-[#14171a] ring-1 ring-black/20">
      <pre class="m-0 overflow-x-auto p-4 pr-24 font-mono text-[12px] leading-relaxed text-[#d6dbe0]"><code>{{ snippet }}</code></pre>
      <CopyButton :value="snippet" tone="dark" class="absolute right-2 top-2" />
    </div>

    <div v-if="sendingDomain" class="grid gap-2">
      <p class="m-0 text-sm text-slate-600">Or send a test from here:</p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton v-if="recipient" type="button" size="md" :loading="sending && sentTo === recipient" :disabled="sending" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="emit('send', recipient)">
          Send to {{ recipient }}
        </UButton>
        <UButton type="button" size="md" color="neutral" variant="outline" :loading="sending && sentTo === simulator" :disabled="sending" class="h-9 rounded-sm bg-white px-3.5 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="emit('send', simulator)">
          Send to Amazon’s simulator
        </UButton>
      </div>
      <p class="m-0 max-w-2xl text-xs leading-relaxed text-slate-500">
        While your SES account is in the sandbox it only delivers to verified addresses; the simulator always accepts and reports a delivery, so you can watch the whole flow.
      </p>
      <p v-if="error" role="alert" class="m-0 text-sm text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
