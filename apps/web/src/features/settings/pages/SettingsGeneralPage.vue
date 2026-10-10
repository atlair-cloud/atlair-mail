<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import CopyButton from '../../../components/shared/CopyButton.vue'
import FactsRow from '../../../components/shared/FactsRow.vue'
import SettingsCard from '../../../components/shared/SettingsCard.vue'
import { authorshipFacts } from '../../../lib/format/authorship'
import { listOrganizations, organizationsQueryKey, useCurrentOrganization, useOrganizationStore } from '../../organizations'
import { deactivateOrganization, getOrganization, isSlugAvailable, organizationQueryKey, updateOrganization } from '../api/organization'

const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()
const organizationStore = useOrganizationStore()
const { organizationId, organization, canManage, isOwner } = useCurrentOrganization()

const details = useQuery({
  queryKey: computed(() => organizationQueryKey(organizationId.value)),
  queryFn: () => getOrganization(organizationId.value),
})
const facts = computed(() => (details.data.value ? authorshipFacts(details.data.value) : null))

const name = ref(organization.value?.name ?? '')
const slug = ref(organization.value?.slug ?? '')
watch(organization, (current) => {
  if (!current) return
  if (!saveName.isPending.value) name.value = current.name
  if (!saveSlug.isPending.value) slug.value = current.slug
})

const refresh = () => queryClient.invalidateQueries({ queryKey: organizationsQueryKey })

const saveName = useMutation({
  mutationFn: () => updateOrganization(organizationId.value, { name: name.value.trim() }),
  async onSuccess() {
    await refresh()
    toast.add({ title: 'Name saved', color: 'neutral' })
  },
})

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/
const cleanSlug = computed(() => slug.value.trim().toLowerCase())
const slugChanged = computed(() => cleanSlug.value !== organization.value?.slug)
const slugValid = computed(() => slugPattern.test(cleanSlug.value))
const debouncedSlug = refDebounced(cleanSlug, 300)
const availability = useQuery({
  queryKey: computed(() => ['slug-availability', debouncedSlug.value] as const),
  queryFn: () => isSlugAvailable(debouncedSlug.value),
  enabled: computed(() => slugChanged.value && slugPattern.test(debouncedSlug.value)),
  staleTime: 10_000,
})
const slugMessage = computed(() => {
  if (!slugChanged.value) return { tone: 'muted', text: 'Lowercase letters, numbers and dashes.' }
  if (!slugValid.value) return { tone: 'error', text: 'Use lowercase letters, numbers and dashes, starting and ending with a letter or number.' }
  if (availability.isFetching.value || debouncedSlug.value !== cleanSlug.value) return { tone: 'muted', text: 'Checking…' }
  if (availability.data.value === false) return { tone: 'error', text: 'That slug is taken.' }
  if (availability.data.value === true) return { tone: 'good', text: 'Available.' }
  return { tone: 'muted', text: '' }
})
const saveSlug = useMutation({
  mutationFn: () => updateOrganization(organizationId.value, { slug: cleanSlug.value }),
  async onSuccess() {
    await refresh()
    toast.add({ title: 'Slug saved', color: 'neutral' })
  },
})

const deactivateOpen = ref(false)
const deactivate = useMutation({
  mutationFn: () => deactivateOrganization(organizationId.value),
  async onSuccess() {
    if (organizationStore.lastOrganizationId === organizationId.value) organizationStore.lastOrganizationId = null
    deactivateOpen.value = false
    const remaining = await listOrganizations()
    queryClient.setQueryData(organizationsQueryKey, remaining)
    if (remaining.length === 0) await router.replace({ name: 'onboarding' })
    else if (remaining.length === 1) await router.replace({ name: 'organization', params: { organizationId: remaining[0]!.id } })
    else await router.replace({ name: 'organizations' })
  },
})
</script>

<template>
  <div v-if="organization" class="divide-y divide-slate-200">
    <SettingsCard title="Name" description="Shown in the panel and in the organization switcher.">
      <label for="org-name" class="sr-only">Organization name</label>
      <UInput id="org-name" v-model="name" size="lg" maxlength="100" class="w-full max-w-md" :ui="{ base: 'h-10 rounded-sm bg-white text-sm' }" :disabled="!canManage || saveName.isPending.value" />
      <p v-if="saveName.error.value" role="alert" class="m-0 mt-2 text-sm text-red-600">{{ saveName.error.value.message }}</p>
      <template #footer>
        <p class="m-0 text-xs text-slate-500">Up to 100 characters.</p>
        <UButton v-if="canManage" type="button" size="md" :loading="saveName.isPending.value" :disabled="!name.trim() || name.trim() === organization.name" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900 disabled:opacity-40" @click="saveName.mutate()">Save</UButton>
      </template>
    </SettingsCard>

    <SettingsCard title="Slug" description="A short, unique handle for this organization.">
      <label for="org-slug" class="sr-only">Slug</label>
      <UInput id="org-slug" v-model="slug" size="lg" maxlength="50" spellcheck="false" class="w-full max-w-md" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="!canManage || saveSlug.isPending.value" />
      <p class="m-0 mt-2 text-xs" :class="slugMessage.tone === 'error' ? 'text-red-600' : slugMessage.tone === 'good' ? 'text-emerald-700' : 'text-slate-500'">{{ slugMessage.text }}</p>
      <p v-if="saveSlug.error.value" role="alert" class="m-0 mt-2 text-sm text-red-600">{{ saveSlug.error.value.message }}</p>
      <template v-if="canManage" #footer>
        <span />
        <UButton type="button" size="md" :loading="saveSlug.isPending.value" :disabled="!slugChanged || !slugValid || availability.data.value === false" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900 disabled:opacity-40" @click="saveSlug.mutate()">Save</UButton>
      </template>
    </SettingsCard>

    <SettingsCard title="Organization ID" description="Used by the API and by support.">
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate font-mono text-sm text-slate-800">{{ organization.id }}</code>
        <CopyButton :value="organization.id" />
      </div>
      <FactsRow v-if="facts" class="mt-4" :facts="facts" />
    </SettingsCard>

    <SettingsCard tone="danger" title="Deactivate organization" :description="`${organization.name} disappears for everyone, and its API keys stop working. Contact the operator if you need it back.`">
      <template #footer>
        <p class="m-0 text-xs text-red-800">Only the owner can do this.</p>
        <UButton
          type="button"
          size="md"
          color="neutral"
          variant="outline"
          :disabled="!isOwner"
          class="h-9 shrink-0 rounded-sm bg-white px-3.5 text-sm font-medium text-red-700 ring-red-200 hover:bg-red-50 hover:ring-red-300 disabled:opacity-50"
          @click="deactivate.reset(); deactivateOpen = true"
        >Deactivate…</UButton>
      </template>
    </SettingsCard>

    <ConfirmModal
      v-model:open="deactivateOpen"
      :title="`Deactivate ${organization.name}?`"
      description="Everyone loses access, and apps using its API keys can no longer send. This can’t be undone from the panel."
      action="Deactivate"
      :confirm-text="organization.name"
      :pending="deactivate.isPending.value"
      :error="deactivate.error.value?.message"
      @confirm="deactivate.mutate()"
    />
  </div>
</template>
