<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GridBackdrop from '../../../components/shared/GridBackdrop.vue'
import { logoUrl } from '../../../lib/brand'
import { getMe, meQueryKey, useSignOut } from '../../auth'
import { createOrganization } from '../api/create-organization'
import { organizationsQueryKey } from '../api/list-organizations'
import { useOrganizationStore } from '../stores/organization'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const organizationStore = useOrganizationStore()
const { signOut, signingOut } = useSignOut()

const isFirstOrganization = computed(() => route.name === 'onboarding')

const { data: user } = useQuery({ queryKey: meQueryKey, queryFn: getMe })

const name = ref('')
const nameInput = useTemplateRef<{ inputRef: HTMLInputElement | null }>('nameInput')
const trimmedName = computed(() => name.value.trim())

watch(
  user,
  async (current) => {
    if (!isFirstOrganization.value || !current || name.value) return
    const firstName = current.name.trim().split(/\s+/)[0]
    name.value = firstName ? `${firstName}’s organization` : 'My organization'
    await nextTick()
    nameInput.value?.inputRef?.select()
  },
  { immediate: true },
)

const { mutate, isPending, error, reset } = useMutation({
  mutationFn: createOrganization,
  async onSuccess(organization) {
    organizationStore.lastOrganizationId = organization.id
    await queryClient.invalidateQueries({ queryKey: organizationsQueryKey })
    await router.replace({ name: 'organization', params: { organizationId: organization.id } })
  },
})

const errorMessage = computed(() => {
  if (!error.value) return ''
  return error.value.message || 'Couldn’t create the organization. Please try again.'
})

watch(name, () => {
  if (error.value) reset()
})

watch(errorMessage, async (message) => {
  if (!message) return
  await nextTick()
  nameInput.value?.inputRef?.focus()
})

function submit() {
  if (!trimmedName.value || isPending.value) return
  mutate({ name: trimmedName.value })
}
</script>

<template>
  <div class="relative flex min-h-full flex-col overflow-hidden px-6">
    <GridBackdrop />

    <div class="relative flex flex-1 items-center justify-center pb-[10vh] pt-16">
      <div class="w-full max-w-90">
        <div class="flex flex-col items-center text-center">
          <img class="size-10 object-contain" :src="logoUrl" alt="" width="40" height="40" />
          <h1 tabindex="-1" id="onboarding-title" class="m-0 outline-none mt-6 text-balance text-[26px] font-semibold leading-tight tracking-tight text-atlair-950">{{ isFirstOrganization ? 'Create your organization' : 'New organization' }}</h1>
          <p class="mb-0 mt-2 text-sm leading-relaxed text-slate-600">{{ isFirstOrganization ? 'Domains, API keys and teammates live in an organization.' : 'A separate space for domains, API keys and teammates.' }}</p>
        </div>

        <form class="mt-8" aria-labelledby="onboarding-title" novalidate @submit.prevent="submit">
          <label for="organization-name" class="block text-xs font-medium text-slate-700">Organization name</label>
          <UInput
            id="organization-name"
            ref="nameInput"
            v-model="name"
            size="xl"
            autofocus
            autocomplete="organization"
            :placeholder="isFirstOrganization ? undefined : 'Acme Inc.'"
            maxlength="100"
            :disabled="isPending"
            :color="errorMessage ? 'error' : 'primary'"
            :highlight="!!errorMessage"
            :aria-invalid="!!errorMessage"
            :aria-describedby="errorMessage ? 'organization-name-error' : 'organization-name-hint'"
            class="mt-2 w-full"
            :ui="{ base: 'min-h-11 rounded-sm bg-white text-sm text-slate-900' }"
          />
          <p v-if="errorMessage" id="organization-name-error" role="alert" class="mb-0 mt-2 text-xs leading-relaxed text-red-600">{{ errorMessage }}</p>

          <UButton type="submit" size="xl" :loading="isPending" :disabled="!trimmedName" class="mt-4 flex min-h-11 w-full justify-center rounded-sm bg-atlair-950 disabled:bg-atlair-950 aria-disabled:bg-atlair-950 disabled:opacity-40 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-atlair-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-atlair-950 motion-reduce:transition-none">
            Create organization
          </UButton>
        </form>

        <p id="organization-name-hint" class="mb-0 mt-5 text-center text-xs leading-relaxed text-slate-500">You can rename it anytime in settings.</p>
        <p v-if="!isFirstOrganization" class="mb-0 mt-3 text-center text-xs">
          <RouterLink class="rounded-sm text-slate-700 hover:text-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950" :to="{ name: 'organizations' }">Cancel</RouterLink>
        </p>

        <div class="mt-10 border-t border-slate-200/80 pt-6 text-center [view-transition-name:page-footer] text-xs leading-relaxed text-slate-500">
          <span v-if="user">Signed in as {{ user.email }} · </span>
          <button type="button" class="rounded-sm text-slate-700 hover:text-atlair-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 disabled:opacity-60" :disabled="signingOut" @click="signOut">Sign out</button>
        </div>
      </div>
    </div>
  </div>
</template>
