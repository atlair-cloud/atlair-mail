<script setup lang="ts">
import { Key, Plus } from '@iconoir/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { computed, ref, useTemplateRef } from 'vue'
import { DataTable, type TableColumn } from '../../../components/data-table'
import ActorName from '../../../components/shared/ActorName.vue'
import AuditStamp from '../../../components/shared/AuditStamp.vue'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import EmptyState from '../../../components/shared/EmptyState.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import SecretReveal from '../../../components/shared/SecretReveal.vue'
import TextButton from '../../../components/shared/TextButton.vue'
import { API_URL } from '../../../lib/api/client'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { useCurrentOrganization } from '../../organizations'
import { API_KEY_PERMISSIONS, apiKeysQueryKey, listApiKeys, revokeApiKey, type ApiKey, type CreatedApiKey } from '../api/api-keys'
import CreateApiKeyForm from '../components/CreateApiKeyForm.vue'

const toast = useToast()
const queryClient = useQueryClient()
const { organizationId, canManage } = useCurrentOrganization()

const query = useQuery({
  queryKey: computed(() => apiKeysQueryKey(organizationId.value)),
  queryFn: () => listApiKeys(organizationId.value),
})

const active = computed(() => (query.data.value ?? []).filter((key) => !key.revokedAt))
const revoked = computed(() => (query.data.value ?? []).filter((key) => key.revokedAt))
const showRevoked = ref(false)

const creating = ref(false)
const created = ref<CreatedApiKey | null>(null)
const createForm = useTemplateRef<{ pending: boolean; canSubmit: boolean }>('createForm')

function openCreate() {
  created.value = null
  creating.value = true
}

const columns: TableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'permission', label: 'Permission', width: 'w-36', hideBelow: 'sm' },
  { key: 'created', label: 'Created', width: 'w-44', hideBelow: 'md' },
  { key: 'lastUsed', label: 'Last used', width: 'w-32', hideBelow: 'lg' },
  { key: 'actions', label: 'Actions', width: 'w-28', align: 'right', labelHiddenOnMobile: true },
]

const permissionLabel = (permission: ApiKey['permission']) => API_KEY_PERMISSIONS.find((option) => option.value === permission)?.label ?? permission

const revoking = ref<ApiKey | null>(null)
const revokeOpen = computed({
  get: () => revoking.value !== null,
  set: (open) => {
    if (!open) revoking.value = null
  },
})
const revoke = useMutation({
  mutationFn: (key: ApiKey) => revokeApiKey(organizationId.value, key.id),
  async onSuccess(key) {
    revoking.value = null
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    toast.add({ title: `“${key.name}” revoked`, description: 'Requests using it now get 401.', color: 'neutral' })
  },
})

function askRevoke(key: ApiKey) {
  revoke.reset()
  revoking.value = key
}
</script>

<template>
  <div>
    <PageHeader eyebrow="API keys" title="Keys for your apps" description="Apps send with an API key in the Authorization header. Each key belongs to this organization and can be revoked at any time.">
      <template v-if="canManage && active.length" #actions>
        <UButton type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="openCreate">
          <Plus aria-hidden="true" class="size-4" />Create key
        </UButton>
      </template>
    </PageHeader>

    <div v-if="query.isPending.value" class="mt-8 skeleton-card h-48 rounded-md ring-1 ring-slate-200" aria-busy="true" aria-label="Loading API keys" />

    <LoadErrorCard v-else-if="query.isError.value" class="mt-8" :error="query.error.value" subject="your API keys" @retry="query.refetch()" />

    <EmptyState v-else-if="active.length === 0" class="mt-8" title="No active keys" description="Create a key for each app or environment, so you can revoke one without touching the others.">
      <template #icon><Key class="size-5" /></template>
      <UButton v-if="canManage" type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900" @click="openCreate">
        <Plus aria-hidden="true" class="size-4" />Create a key
      </UButton>
      <p v-else class="m-0 text-xs text-slate-500">An owner or admin can create keys.</p>
    </EmptyState>

    <DataTable v-else class="mt-8" label="API keys" :columns="columns" :rows="active" :row-key="(key) => key.id">
      <template #cell-name="{ row }">
        <span class="block truncate font-medium text-slate-900">{{ row.name }}</span>
        <span class="block truncate font-mono text-[11px] text-slate-500">{{ row.tokenPrefix }}…</span>
      </template>
      <template #cell-permission="{ row }">
        <span class="rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset" :class="row.permission === 'full_access' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-50 text-slate-700 ring-slate-200'">{{ permissionLabel(row.permission) }}</span>
      </template>
      <template #cell-created="{ row }"><AuditStamp :at="row.createdAt" :by="row.createdBy" /></template>
      <template #cell-lastUsed="{ row }">
        <time v-if="row.lastUsedAt" :datetime="row.lastUsedAt" :title="new Date(row.lastUsedAt).toLocaleString()" class="font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(row.lastUsedAt) }}</time>
        <span v-else class="text-xs text-slate-500">Never</span>
      </template>
      <template #cell-actions="{ row }">
        <TextButton v-if="canManage" tone="danger" @click="askRevoke(row)">Revoke</TextButton>
      </template>
    </DataTable>

    <section v-if="revoked.length" class="mt-6">
      <button type="button" class="rounded-sm text-sm font-medium text-slate-600 hover:text-slate-900" :aria-expanded="showRevoked" @click="showRevoked = !showRevoked">
        {{ showRevoked ? 'Hide' : 'Show' }} {{ revoked.length }} revoked {{ revoked.length === 1 ? 'key' : 'keys' }}
      </button>
      <ul v-if="showRevoked" class="m-0 mt-3 list-none divide-y divide-slate-100 overflow-hidden rounded-md bg-white p-0 ring-1 ring-slate-200">
        <li v-for="key in revoked" :key="key.id" class="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <span class="min-w-0 truncate text-slate-500 line-through decoration-slate-300">{{ key.name }}</span>
          <span class="flex shrink-0 flex-wrap items-center justify-end gap-x-1 text-[11px] text-slate-500">
            <span class="font-mono">{{ key.tokenPrefix }}…</span>
            · created {{ formatRelativeTime(key.createdAt) }}<template v-if="key.createdBy"> by <ActorName :actor="key.createdBy" class="text-slate-700" /></template>
            · revoked <time :datetime="key.revokedAt!" :title="new Date(key.revokedAt!).toLocaleString()">{{ formatRelativeTime(key.revokedAt!) }}</time><template v-if="key.updatedBy"> by <ActorName :actor="key.updatedBy" class="text-slate-700" /></template>
          </span>
        </li>
      </ul>
    </section>

    <section class="mt-10 rounded-md bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
      <h2 class="m-0 text-sm font-semibold text-slate-900">Using a key</h2>
      <p class="m-0 mt-1 text-sm text-slate-600">Send it as a bearer token. Keep it on your server; never ship it to browsers or mobile apps.</p>
      <pre class="m-0 mt-3 overflow-x-auto rounded-sm bg-[#14171a] p-3 font-mono text-[12px] leading-relaxed text-[#d6dbe0]"><code>curl {{ API_URL }}/service/web/emails -H "Authorization: Bearer $ATLAIR_MAIL_API_KEY" ...</code></pre>
    </section>

    <FramedModal v-model:open="creating" :title="created ? 'Copy your new key' : 'Create an API key'" :description="created ? 'This is the only time it’s shown.' : 'Give it a name and choose what it can do.'" width="xl" :dismissible="!created">
      <SecretReveal v-if="created" :title="`“${created.name}” is ready`" :secret="created.token" hint="Store it as ATLAIR_MAIL_API_KEY in your app’s environment. If it’s lost, revoke it and create a new one." />
      <CreateApiKeyForm v-else ref="createForm" :organization-id="organizationId" :cancellable="false" in-modal @created="created = $event" />
      <template #footer>
        <template v-if="created">
          <span />
          <UButton type="button" size="lg" class="rounded-md bg-atlair-950 px-4 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="creating = false">I’ve saved it</UButton>
        </template>
        <ModalActions v-else action="Create key" form="create-api-key-form" :pending="createForm?.pending" :disabled="!createForm?.canSubmit" @cancel="creating = false" />
      </template>
    </FramedModal>

    <ConfirmModal
      v-model:open="revokeOpen"
      :title="`Revoke “${revoking?.name}”?`"
      description="Apps using it stop being able to send right away. This can’t be undone."
      action="Revoke key"
      :pending="revoke.isPending.value"
      :error="revoke.error.value?.message"
      @confirm="revoking && revoke.mutate(revoking)"
    />
  </div>
</template>
