<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCurrentOrganization } from '../../features/organizations'

const route = useRoute()
const router = useRouter()
const { organizationId } = useCurrentOrganization()

const sections = [
  { key: 'overview', label: 'Overview', name: 'organization' },
  { key: 'emails', label: 'Emails', name: 'emails' },
  { key: 'domains', label: 'Domains', name: 'domains' },
  { key: 'api-keys', label: 'API keys', name: 'api-keys' },
  { key: 'webhooks', label: 'Webhooks', name: 'webhooks' },
  { key: 'suppressions', label: 'Suppressions', name: 'suppressions' },
  { key: 'settings', label: 'Settings', name: 'organization-settings' },
]

const tabs = computed(() => sections.filter((section) => router.hasRoute(section.name)))
</script>

<template>
  <nav aria-label="Sections" class="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="{ name: tab.name, params: { organizationId } }"
      class="relative shrink-0 rounded-sm px-2.5 pb-2.5 pt-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
      :class="route.meta.section === tab.key ? 'font-medium text-white' : 'text-white/60 hover:text-white'"
      :aria-current="route.meta.section === tab.key ? 'page' : undefined"
    >
      {{ tab.label }}
      <span v-if="route.meta.section === tab.key" aria-hidden="true" class="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-white" />
    </RouterLink>
  </nav>
</template>
