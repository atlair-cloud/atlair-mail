<script setup lang="ts">
import { Mail } from '@iconoir/vue'
import { computed } from 'vue'
import EmptyState from '../../../components/shared/EmptyState.vue'
import { useCurrentOrganization } from '../composables/useCurrentOrganization'

const { organization } = useCurrentOrganization()
const roleLabel = computed(() => {
  const role = organization.value?.role ?? ''
  return role.charAt(0).toUpperCase() + role.slice(1)
})
</script>

<template>
  <div v-if="organization">
    <p class="m-0 font-mono text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Overview</p>
    <h1 tabindex="-1" class="m-0 mt-2 text-[26px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ organization.name }}</h1>
    <p class="mb-0 mt-2 text-sm text-slate-600">
      <span class="font-mono text-slate-500">{{ organization.slug }}</span>
      <span aria-hidden="true" class="mx-2 text-slate-300">·</span>
      You’re {{ roleLabel === 'Admin' || roleLabel === 'Owner' ? 'an' : 'a' }} {{ roleLabel.toLowerCase() }}
    </p>

    <EmptyState
      class="mt-10"
      title="Nothing sent yet"
      description="Domains, API keys, emails and webhooks for this organization will show up here."
    >
      <template #icon><Mail class="size-5" /></template>
    </EmptyState>
  </div>
</template>
