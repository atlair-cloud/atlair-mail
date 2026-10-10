<script setup lang="ts">
import { OpenNewWindow } from '@iconoir/vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCurrentOrganization } from '../../features/organizations'
import { API_DOCS_URL } from '../../lib/links'

const route = useRoute()
const router = useRouter()
const { organizationId } = useCurrentOrganization()

const sections = [
  { key: 'overview', label: 'Overview', name: 'organization' },
  { key: 'emails', label: 'Emails', name: 'emails' },
  { key: 'templates', label: 'Templates', name: 'templates' },
  { key: 'domains', label: 'Domains', name: 'domains' },
  { key: 'api-keys', label: 'API keys', name: 'api-keys' },
  { key: 'webhooks', label: 'Webhooks', name: 'webhooks' },
  { key: 'suppressions', label: 'Suppressions', name: 'suppressions' },
  { key: 'playground', label: 'Playground', name: 'playground' },
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
      class="relative shrink-0 rounded-sm px-2.5 pb-3 pt-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
      :class="route.meta.section === tab.key ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'"
      :aria-current="route.meta.section === tab.key ? 'page' : undefined"
    >
      {{ tab.label }}
      <span v-if="route.meta.section === tab.key" aria-hidden="true" class="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-slate-900" />
    </RouterLink>
    <a
      :href="API_DOCS_URL"
      target="_blank"
      rel="noopener"
      class="inline-flex shrink-0 items-center gap-1 rounded-sm px-2.5 pb-3 pt-3.5 text-sm text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
    >API docs<OpenNewWindow aria-hidden="true" class="size-3" /><span class="sr-only"> (opens in a new tab)</span></a>
  </nav>
</template>
