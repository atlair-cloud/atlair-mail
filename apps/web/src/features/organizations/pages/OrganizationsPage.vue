<script setup lang="ts">
import { NavArrowRight, Plus } from '@iconoir/vue'
import { useQuery } from '@tanstack/vue-query'
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import GridBackdrop from '../../../components/shared/GridBackdrop.vue'
import SlowNotice from '../../../components/shared/SlowNotice.vue'
import { logoUrl } from '../../../lib/brand'
import { getMe, meQueryKey, useSignOut } from '../../auth'
import { listOrganizations, organizationsQueryKey } from '../api/list-organizations'
import { useOrganizationStore } from '../stores/organization'

const router = useRouter()
const organizationStore = useOrganizationStore()
const { signOut, signingOut } = useSignOut()

const { data: user } = useQuery({ queryKey: meQueryKey, queryFn: getMe })
const { data: organizations, isPending, isError, refetch } = useQuery({ queryKey: organizationsQueryKey, queryFn: listOrganizations })

watch(organizations, (items) => {
  if (items?.length === 0) router.replace({ name: 'onboarding' })
})

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}
</script>

<template>
  <div class="relative flex min-h-full flex-col overflow-hidden px-6">
    <GridBackdrop />

    <div class="relative flex flex-1 items-center justify-center pb-[10vh] pt-16">
      <div class="w-full max-w-110">
        <div class="flex flex-col items-center text-center">
          <img class="size-10 object-contain" :src="logoUrl" alt="" width="40" height="40" />
          <h1 tabindex="-1" id="organizations-title" class="m-0 outline-none mt-6 text-balance text-[26px] font-semibold leading-tight tracking-tight text-atlair-950">Your organizations</h1>
          <p class="mb-0 mt-2 text-sm leading-relaxed text-slate-600">Choose where you want to work.</p>
        </div>

        <div v-if="isPending" class="mt-8 divide-y divide-slate-100 rounded-sm bg-white ring-1 ring-slate-200" aria-busy="true" aria-label="Loading organizations">
          <div v-for="n in 3" :key="n" class="flex items-center gap-3 px-4 py-3.5">
            <div class="size-8 skeleton rounded-sm" />
            <div class="h-3 w-32 skeleton rounded-sm" />
          </div>
        </div>
        <SlowNotice v-if="isPending" class="mt-4" what="your organizations" />

        <div v-else-if="isError" class="mt-8 rounded-sm bg-white px-4 py-6 text-center ring-1 ring-slate-200">
          <p role="alert" class="m-0 text-sm text-slate-700">Couldn’t load your organizations.</p>
          <button type="button" class="mt-2 rounded-sm text-xs font-medium text-slate-700 hover:text-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950" @click="refetch()">Try again</button>
        </div>

        <nav v-else class="mt-8" aria-labelledby="organizations-title">
          <ul class="m-0 list-none divide-y divide-slate-100 overflow-hidden rounded-sm bg-white p-0 ring-1 ring-slate-200">
            <li v-for="organization in organizations" :key="organization.id">
              <RouterLink
                :to="{ name: 'organization', params: { organizationId: organization.id } }"
                class="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
              >
                <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-sm font-semibold text-slate-800">{{ organization.name.trim().charAt(0).toUpperCase() }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-slate-900">{{ organization.name }}</span>
                  <span class="block text-xs text-slate-500">{{ roleLabel(organization.role) }}</span>
                </span>
                <span v-if="organization.id === organizationStore.lastOrganizationId" class="shrink-0 rounded-sm bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-100">Last used</span>
                <NavArrowRight aria-hidden="true" class="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
              </RouterLink>
            </li>
            <li>
              <RouterLink
                :to="{ name: 'organization-new' }"
                class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-atlair-950 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
              >
                <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-sm border border-dashed border-slate-300 text-slate-500">
                  <Plus class="size-4" />
                </span>
                New organization
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div class="mt-10 border-t border-slate-200/80 pt-6 text-center [view-transition-name:page-footer] text-xs leading-relaxed text-slate-500">
          <span v-if="user">Signed in as {{ user.email }} · </span>
          <button type="button" class="rounded-sm text-slate-700 hover:text-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 disabled:opacity-60" :disabled="signingOut" @click="signOut">Sign out</button>
        </div>
      </div>
    </div>
  </div>
</template>
