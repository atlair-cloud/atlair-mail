<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCurrentOrganization } from '../../organizations'
import { listMembers, membersQueryKey } from '../api/members'
import { roleLabel } from '../lib/roles'

const route = useRoute()
const { organizationId, organization, canManage } = useCurrentOrganization()

const members = useQuery({
  queryKey: computed(() => membersQueryKey(organizationId.value)),
  queryFn: () => listMembers(organizationId.value),
})

const links = computed(() =>
  [
    { name: 'organization-settings', label: 'General', show: true },
    { name: 'organization-settings-provider', label: 'Provider', show: true },
    { name: 'organization-settings-members', label: 'Members', show: true },
    { name: 'organization-settings-activity', label: 'Audit log', show: canManage.value },
  ].filter((link) => link.show),
)

const sentence = computed(() => {
  if (!organization.value) return ''
  const role = organization.value.role
  const you = role === 'member' ? 'You’re a member, so these pages are read-only.' : `You’re ${role === 'owner' ? 'the owner' : 'an admin'}.`
  const count = members.data.value?.length
  if (!count) return you
  return count === 1 ? `It’s just you in ${organization.value.name} so far. ${you}` : `${count} people share ${organization.value.name}. ${you}`
})
</script>

<template>
  <div v-if="organization">
    <div class="sticky top-0 z-20 -mt-10 bg-canvas pt-10 shadow-[0_0_0_100vmax_var(--color-canvas)] [clip-path:inset(0_-100vmax)] sm:-mt-14 sm:pt-14">
      <header class="min-w-0">
        <p class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Settings · {{ roleLabel(organization.role) }}</p>
        <h1 tabindex="-1" class="m-0 mt-1.5 truncate text-[28px] font-semibold leading-tight tracking-tight text-atlair-950 outline-none">{{ organization.name }}</h1>
        <p class="mb-0 mt-1.5 text-sm text-slate-600">{{ sentence }}</p>
      </header>
      <nav aria-label="Settings" class="mt-8 border-b border-slate-200">
        <ul class="-mb-px m-0 flex list-none gap-6 overflow-x-auto p-0">
          <li v-for="link in links" :key="link.name" class="shrink-0">
            <RouterLink
              :to="{ name: link.name, params: { organizationId } }"
              class="flex items-center gap-1.5 border-b-2 px-0.5 pb-3 pt-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
              :class="route.name === link.name ? 'border-atlair-950 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:border-slate-400 hover:text-atlair-950'"
              :aria-current="route.name === link.name ? 'page' : undefined"
            >
              {{ link.label }}
              <span v-if="link.name === 'organization-settings-members' && members.data.value" class="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-700 ring-1 ring-inset ring-slate-200">{{ members.data.value.length }}</span>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>

    <div class="pt-10">
      <RouterView v-slot="{ Component }">
        <Transition name="tab">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>
