<script setup lang="ts">
import { Check, NavArrowDown } from '@iconoir/vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCurrentOrganization } from '../../features/organizations'

const router = useRouter()
const { organization, organizations } = useCurrentOrganization()

const items = computed<DropdownMenuItem[][]>(() => [
  organizations.value.map((org) => ({
    label: org.name,
    current: org.id === organization.value?.id,
    onSelect: () => router.push({ name: 'organization', params: { organizationId: org.id } }),
  })),
  [
    { label: 'All organizations', onSelect: () => router.push({ name: 'organizations' }) },
    { label: 'New organization', onSelect: () => router.push({ name: 'organization-new' }) },
  ],
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start', sideOffset: 8 }" :ui="{ content: 'w-60 rounded-sm', item: 'rounded-sm text-sm' }">
    <button
      type="button"
      class="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[state=open]:bg-white/15 motion-reduce:transition-none"
      aria-label="Switch organization"
    >
      <span class="truncate">{{ organization?.name ?? 'Organization' }}</span>
      <NavArrowDown aria-hidden="true" class="size-3.5 shrink-0 text-white/50" />
    </button>

    <template #item-trailing="{ item }">
      <Check v-if="item.current" aria-label="Current organization" class="size-4 text-atlair-950" />
    </template>
  </UDropdownMenu>
</template>
