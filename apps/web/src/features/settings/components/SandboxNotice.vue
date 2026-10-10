<script setup lang="ts">
import type { ProviderAccount } from '../api/provider'

defineProps<{ account: ProviderAccount; region: string }>()
</script>

<template>
  <div v-if="account.sandbox" class="rounded-md bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200">
    <p class="m-0 font-medium text-slate-900">Your SES account is in the sandbox</p>
    <p class="m-0 mt-1 leading-relaxed text-slate-600">
      It can only send to addresses verified in SES, up to {{ account.dailyQuota }} a day. Testing works now; for real recipients,
      <a :href="`https://${region}.console.aws.amazon.com/ses/home?region=${region}#/account`" target="_blank" rel="noopener" class="font-medium text-slate-800 underline decoration-slate-300 underline-offset-4">request production access</a>.
    </p>
  </div>
  <div v-else class="rounded-md bg-emerald-50 px-4 py-3 text-sm ring-1 ring-emerald-200">
    <p class="m-0 font-medium text-slate-900">Production access</p>
    <p class="m-0 mt-1 text-slate-600">Up to {{ account.dailyQuota.toLocaleString() }} emails a day, {{ account.maxSendRate }} per second.</p>
  </div>
</template>
