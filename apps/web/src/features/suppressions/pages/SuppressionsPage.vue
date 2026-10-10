<script setup lang="ts">
import { Plus, Prohibition, Search } from '@iconoir/vue'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { refDebounced } from '@vueuse/core'
import { computed, ref } from 'vue'
import AuditStamp from '../../../components/shared/AuditStamp.vue'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import EmptyState from '../../../components/shared/EmptyState.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import TextButton from '../../../components/shared/TextButton.vue'
import { useCurrentOrganization } from '../../organizations'
import { addSuppression, listSuppressions, removeSuppression, SUPPRESSION_REASON, suppressionsQueryKey, type Suppression } from '../api/suppressions'

const toast = useToast()
const queryClient = useQueryClient()
const { organizationId, canManage } = useCurrentOrganization()

const search = ref('')
const debounced = refDebounced(search, 300)
const lookup = computed(() => {
  const value = debounced.value.trim().toLowerCase()
  return value.includes('@') && value.length >= 3 ? value : null
})

const query = useInfiniteQuery({
  queryKey: computed(() => suppressionsQueryKey(organizationId.value, lookup.value)),
  queryFn: ({ pageParam }) => listSuppressions(organizationId.value, { address: lookup.value, after: pageParam }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.data.at(-1)?.id : undefined),
})
const rows = computed(() => query.data.value?.pages.flatMap((page) => page.data) ?? [])

const adding = ref(false)
const newAddress = ref('')
const validAddress = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAddress.value.trim()))
const add = useMutation({
  mutationFn: () => addSuppression(organizationId.value, newAddress.value.trim().toLowerCase()),
  async onSuccess(entry) {
    adding.value = false
    newAddress.value = ''
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    toast.add({ title: `${entry.address} suppressed`, description: 'Emails to it are skipped from now on.', color: 'neutral' })
  },
})

const removing = ref<Suppression | null>(null)
const removeOpen = computed({
  get: () => removing.value !== null,
  set: (open) => {
    if (!open) removing.value = null
  },
})
const remove = useMutation({
  mutationFn: (entry: Suppression) => removeSuppression(organizationId.value, entry.id),
  async onSuccess(_result, entry) {
    removing.value = null
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    toast.add({ title: `${entry.address} can receive email again`, color: 'neutral' })
  },
})

function openAdd() {
  add.reset()
  newAddress.value = lookup.value ?? ''
  adding.value = true
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Suppressions" title="Addresses you won’t email" description="Hard bounces and spam complaints are added automatically, which protects your SES reputation. Emails to these addresses are skipped and marked failed.">
      <template v-if="canManage" #actions>
        <UButton type="button" size="md" color="neutral" variant="outline" class="h-9 rounded-sm bg-white px-3.5 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="openAdd">
          <Plus aria-hidden="true" class="size-4" />Add address
        </UButton>
      </template>
    </PageHeader>

    <div class="mt-6 max-w-md">
      <label for="suppression-search" class="sr-only">Look up an address</label>
      <UInput id="suppression-search" v-model="search" type="email" size="lg" placeholder="Look up an address, like ada@example.com" autocomplete="off" spellcheck="false" class="w-full" :ui="{ base: 'h-10 rounded-sm bg-white pl-9 text-sm' }">
        <template #leading><Search aria-hidden="true" class="size-4 text-slate-400" /></template>
      </UInput>
      <p v-if="search && !lookup" class="m-0 mt-1.5 text-xs text-slate-500">Type the full address to look it up.</p>
    </div>

    <div v-if="query.isPending.value" class="mt-6 skeleton-card h-48 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading suppressions" />

    <LoadErrorCard v-else-if="query.isError.value" class="mt-6" :error="query.error.value" subject="suppressions" @retry="query.refetch()" />

    <EmptyState
      v-else-if="rows.length === 0"
      class="mt-6"
      :title="lookup ? `${lookup} isn’t suppressed` : 'Nothing suppressed'"
      :description="lookup ? 'Emails to this address are sent normally.' : 'Every address you send to is reachable. Bounces and complaints will appear here.'"
    >
      <template #icon><Prohibition class="size-5" /></template>
      <TextButton v-if="lookup && canManage" @click="openAdd">Suppress {{ lookup }}</TextButton>
    </EmptyState>

    <template v-else>
      <div class="mt-6 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
        <table class="w-full table-fixed border-collapse text-sm">
          <thead class="border-b border-slate-100 text-left">
            <tr class="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
              <th scope="col" class="px-4 py-2.5 font-medium">Address</th>
              <th scope="col" class="hidden w-56 px-4 py-2.5 font-medium sm:table-cell">Reason</th>
              <th scope="col" class="hidden w-44 px-4 py-2.5 font-medium md:table-cell">Added</th>
              <th scope="col" class="w-28 px-4 py-2.5"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="entry in rows" :key="entry.id">
              <td class="min-w-0 px-4 py-3">
                <span class="block truncate font-medium text-slate-900">{{ entry.address }}</span>
                <RouterLink v-if="entry.sourceEmailId" :to="{ name: 'email', params: { organizationId, emailId: entry.sourceEmailId } }" class="text-xs text-slate-500 hover:text-slate-900 hover:underline">See the email that caused it</RouterLink>
              </td>
              <td class="hidden px-4 py-3 sm:table-cell" :title="SUPPRESSION_REASON[entry.reason].description">
                <span class="inline-flex items-center gap-1.5 text-slate-700"><span aria-hidden="true" class="size-2 rounded-full" :class="SUPPRESSION_REASON[entry.reason].dot" />{{ SUPPRESSION_REASON[entry.reason].label }}</span>
              </td>
              <td class="hidden px-4 py-3 md:table-cell"><AuditStamp :at="entry.createdAt" :by="entry.createdBy" :fallback="entry.reason === 'manual' ? '—' : 'Automatic'" /></td>
              <td class="px-4 py-3 text-right">
                <TextButton v-if="canManage" @click="remove.reset(); removing = entry">Remove</TextButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="query.hasNextPage.value" class="mt-4 text-right">
        <UButton type="button" size="sm" color="neutral" variant="outline" :loading="query.isFetchingNextPage.value" class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100" @click="query.fetchNextPage()">Load more</UButton>
      </div>
    </template>

    <FramedModal v-model:open="adding" title="Suppress an address" description="Atlair Mail stops sending to it, for example when someone asks not to be emailed.">
      <form id="suppress-form" novalidate @submit.prevent="validAddress && !add.isPending.value && add.mutate()">
        <label for="suppress-address" class="block text-xs font-medium text-slate-700">Email address</label>
        <UInput id="suppress-address" v-model="newAddress" type="email" size="lg" autofocus autocomplete="off" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white text-sm' }" :disabled="add.isPending.value" />
        <p v-if="add.error.value" role="alert" class="m-0 mt-2 text-sm text-red-600">{{ add.error.value.message }}</p>
      </form>
      <template #footer>
        <ModalActions action="Suppress" form="suppress-form" :pending="add.isPending.value" :disabled="!validAddress" @cancel="adding = false" />
      </template>
    </FramedModal>

    <ConfirmModal
      v-model:open="removeOpen"
      :title="`Email ${removing?.address} again?`"
      :description="removing?.reason === 'manual' ? 'Emails to this address will be sent again.' : 'Only do this if you know the address works and the person wants your email. Another bounce or complaint hurts your SES reputation.'"
      action="Remove from list"
      :pending="remove.isPending.value"
      :error="remove.error.value?.message"
      @confirm="removing && remove.mutate(removing)"
    />
  </div>
</template>
