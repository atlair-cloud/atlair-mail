<script setup lang="ts">
import { NavArrowLeft } from '@iconoir/vue'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { useNow } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChoiceCards from '../../../components/shared/ChoiceCards.vue'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import FactsRow from '../../../components/shared/FactsRow.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import NotFound from '../../../components/shared/NotFound.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import SecretReveal from '../../../components/shared/SecretReveal.vue'
import SettingsCard from '../../../components/shared/SettingsCard.vue'
import { ApiError } from '../../../lib/api/client'
import { authorshipFacts } from '../../../lib/format/authorship'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { useCurrentOrganization } from '../../organizations'
import {
  deleteWebhook,
  getWebhook,
  listWebhookDeliveries,
  rotateWebhookSecret,
  updateWebhook,
  webhookDeliveriesQueryKey,
  webhookQueryKey,
  type WebhookDelivery,
  type WebhookEventType,
  type WebhookWithSecret,
} from '../api/webhooks'
import VerifyGuide from '../components/VerifyGuide.vue'
import WebhookForm from '../components/WebhookForm.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()
const now = useNow({ interval: 15_000 })
const { organizationId, canManage } = useCurrentOrganization()
const webhookId = computed(() => String(route.params.webhookId))

const query = useQuery({
  queryKey: computed(() => webhookQueryKey(organizationId.value, webhookId.value)),
  queryFn: () => getWebhook(organizationId.value, webhookId.value),
})
const webhook = computed(() => query.data.value)
const notFound = computed(() => query.error.value instanceof ApiError && query.error.value.status === 404)

const deliveries = useInfiniteQuery({
  queryKey: computed(() => webhookDeliveriesQueryKey(organizationId.value, webhookId.value)),
  queryFn: ({ pageParam }) => listWebhookDeliveries(organizationId.value, webhookId.value, pageParam),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.data.at(-1)?.id : undefined),
  enabled: computed(() => !!webhook.value),
  refetchInterval: (state) => (state.state.data?.pages[0]?.data.some((delivery) => delivery.status === 'pending') ? 10_000 : 60_000),
})
const deliveryRows = computed(() => deliveries.data.value?.pages.flatMap((page) => page.data) ?? [])

const refreshWebhook = (updated: { id: string }) => {
  queryClient.setQueryData(webhookQueryKey(organizationId.value, updated.id), updated)
  return queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value, 'webhooks'] })
}

const editing = ref(false)
const editForm = useTemplateRef<{ canSubmit: boolean }>('editForm')
const update = useMutation({
  mutationFn: (input: { url?: string; eventTypes?: WebhookEventType[]; enabled?: boolean }) => updateWebhook(organizationId.value, webhookId.value, input),
  async onSuccess(updated, input) {
    editing.value = false
    await refreshWebhook(updated)
    if (input.enabled !== undefined) toast.add({ title: input.enabled ? 'Endpoint enabled' : 'Endpoint disabled', description: input.enabled ? 'New events are sent again.' : 'It receives nothing until you enable it.', color: 'neutral' })
    else toast.add({ title: 'Endpoint updated', color: 'neutral' })
  },
})

const disableOpen = ref(false)

const rotateOpen = ref(false)
const overlapHours = ref(24)
const rotated = ref<WebhookWithSecret | null>(null)
const overlapOptions = [
  { value: 24, label: '24 hours', description: 'Recommended. Both secrets sign requests for a day while you deploy the new one.' },
  { value: 168, label: '7 days', description: 'For slow rollouts.' },
  { value: 0, label: 'Right away', description: 'The old secret stops at once. Use if it leaked.' },
]
const rotate = useMutation({
  mutationFn: () => rotateWebhookSecret(organizationId.value, webhookId.value, overlapHours.value),
  async onSuccess(result) {
    rotated.value = result
    await refreshWebhook(result)
  },
})
function openRotate() {
  rotated.value = null
  overlapHours.value = 24
  rotate.reset()
  rotateOpen.value = true
}

const deleteOpen = ref(false)
const remove = useMutation({
  mutationFn: () => deleteWebhook(organizationId.value, webhookId.value),
  async onSuccess() {
    deleteOpen.value = false
    queryClient.removeQueries({ queryKey: webhookQueryKey(organizationId.value, webhookId.value) })
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
    await router.replace({ name: 'webhooks', params: { organizationId: organizationId.value } })
    toast.add({ title: 'Endpoint deleted', color: 'neutral' })
  },
})

const deliveryTone: Record<WebhookDelivery['status'], { dot: string; label: string }> = {
  delivered: { dot: 'bg-status-live', label: 'Delivered' },
  pending: { dot: 'bg-status-active', label: 'Retrying' },
  failed: { dot: 'bg-red-500', label: 'Failed' },
}

function deliveryDetail(delivery: WebhookDelivery) {
  if (delivery.status === 'delivered') return delivery.lastResponseStatus ? `HTTP ${delivery.lastResponseStatus}` : 'Delivered'
  const reason = delivery.lastResponseStatus ? `HTTP ${delivery.lastResponseStatus}` : (delivery.lastError ?? '')
  if (delivery.status === 'pending') {
    if (delivery.attempts === 0) return 'Queued'
    return `${reason} · attempt ${delivery.attempts} of 8${delivery.nextAttemptAt ? ` · next ${formatRelativeTime(delivery.nextAttemptAt, now.value.getTime())}` : ''}`
  }
  return `${reason} · gave up after ${delivery.attempts} attempts`
}
</script>

<template>
  <div>
    <RouterLink :to="{ name: 'webhooks', params: { organizationId } }" class="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950">
      <NavArrowLeft aria-hidden="true" class="size-4" />All webhooks
    </RouterLink>

    <div v-if="query.isPending.value" class="mt-6 grid gap-4" aria-busy="true" aria-label="Loading the endpoint">
      <div class="skeleton h-8 w-96 max-w-full rounded-sm" />
      <div class="skeleton-card h-64 rounded-md ring-1 ring-slate-200" />
    </div>

    <NotFound v-else-if="notFound" title="We couldn’t find that endpoint" body="It may have been deleted, or it belongs to another organization." :to="{ name: 'webhooks', params: { organizationId } }" to-label="Go to webhooks" />

    <LoadErrorCard v-else-if="query.isError.value" class="mt-6" :error="query.error.value" subject="this endpoint" @retry="query.refetch()" />

    <template v-else-if="webhook">
      <PageHeader class="mt-5" eyebrow="Webhook endpoint" :title="webhook.url">
        <template #description>
          <span class="inline-flex items-center gap-1.5">
            <span aria-hidden="true" class="size-2 rounded-full" :class="webhook.enabled ? 'bg-status-live' : 'bg-slate-300'" />
            {{ webhook.enabled ? 'Enabled: events are sent as they happen.' : 'Disabled: nothing is sent until you enable it.' }}
          </span>
        </template>
        <template v-if="canManage" #actions>
          <UButton type="button" size="md" color="neutral" variant="outline" class="h-9 rounded-sm bg-white px-3.5 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="update.reset(); editing = true">Edit</UButton>
          <UButton
            v-if="webhook.enabled"
            type="button"
            size="md"
            color="neutral"
            variant="outline"
            class="h-9 rounded-sm bg-white px-3.5 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100"
            @click="disableOpen = true"
          >Disable</UButton>
          <UButton v-else type="button" size="md" :loading="update.isPending.value" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900" @click="update.mutate({ enabled: true })">Enable</UButton>
        </template>
      </PageHeader>

      <FactsRow class="mt-6" :facts="authorshipFacts(webhook)" />

      <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="deliveries-heading" class="min-w-0 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
          <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <h2 id="deliveries-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Recent deliveries</h2>
            <span class="text-xs text-slate-500">Newest first</span>
          </header>
          <div v-if="deliveries.isPending.value" class="skeleton-card h-40" aria-busy="true" />
          <p v-else-if="deliveryRows.length === 0" class="m-0 px-4 py-10 text-center text-sm text-slate-500">Nothing sent yet. Deliveries appear here as soon as a subscribed event happens.</p>
          <ul v-else class="m-0 list-none divide-y divide-slate-100 p-0">
            <li v-for="delivery in deliveryRows" :key="delivery.id" class="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-sm">
              <span class="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <span aria-hidden="true" class="size-2 rounded-full" :class="deliveryTone[delivery.status].dot" />{{ deliveryTone[delivery.status].label }}
              </span>
              <span class="min-w-0">
                <span class="flex min-w-0 items-baseline gap-2">
                  <span class="font-mono text-xs font-medium text-slate-900">{{ delivery.eventType }}</span>
                  <RouterLink :to="{ name: 'email', params: { organizationId, emailId: delivery.emailId } }" class="shrink-0 rounded-sm text-xs text-slate-500 hover:text-slate-900 hover:underline">View email</RouterLink>
                </span>
                <span class="block truncate text-xs" :class="delivery.status === 'failed' ? 'text-red-600' : 'text-slate-500'" :title="delivery.lastError ?? undefined">{{ deliveryDetail(delivery) }}</span>
              </span>
              <time :datetime="delivery.createdAt" class="font-mono text-[11px] tabular-nums text-slate-500">{{ formatRelativeTime(delivery.createdAt, now.getTime()) }}</time>
            </li>
          </ul>
          <footer v-if="deliveries.hasNextPage.value" class="border-t border-slate-100 px-4 py-2.5 text-right">
            <UButton type="button" size="sm" color="neutral" variant="outline" :loading="deliveries.isFetchingNextPage.value" class="h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-700 ring-slate-200 hover:bg-slate-100" @click="deliveries.fetchNextPage()">Load older</UButton>
          </footer>
        </section>

        <aside class="grid min-w-0 content-start gap-4">
          <section aria-labelledby="events-heading" class="rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
            <h2 id="events-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Subscribed events</h2>
            <ul class="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
              <li v-for="eventType in webhook.eventTypes" :key="eventType" class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{{ eventType }}</li>
            </ul>
          </section>
          <section aria-labelledby="secret-heading" class="rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
            <h2 id="secret-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Signing secret</h2>
            <p class="m-0 mt-2 text-sm text-slate-600">
              <template v-if="webhook.previousSecretExpiresAt">Rotating: the previous secret also signs until {{ new Date(webhook.previousSecretExpiresAt).toLocaleString() }}.</template>
              <template v-else>Shown only when created or rotated.</template>
            </p>
            <UButton v-if="canManage" type="button" size="sm" color="neutral" variant="outline" class="mt-3 h-8 rounded-sm bg-white px-3 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="openRotate">Rotate secret</UButton>
          </section>
        </aside>
      </div>

      <section class="mt-8 rounded-md bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
        <h2 class="m-0 mb-2 text-sm font-semibold text-slate-900">Receiving events</h2>
        <VerifyGuide />
      </section>

      <div v-if="canManage" class="mt-12 border-t border-slate-200 pt-8">
        <SettingsCard tone="danger" title="Delete endpoint" description="Removes the endpoint, its delivery history and anything not yet delivered.">
          <template #footer>
            <p class="m-0 text-xs text-red-800">To pause instead, disable it.</p>
            <UButton type="button" size="md" color="neutral" variant="outline" class="h-9 shrink-0 rounded-sm bg-white px-3.5 text-sm font-medium text-red-700 ring-red-200 hover:bg-red-50 hover:ring-red-300" @click="remove.reset(); deleteOpen = true">Delete…</UButton>
          </template>
        </SettingsCard>
      </div>

      <FramedModal v-model:open="editing" title="Edit endpoint" description="Changes apply to the next event." width="xl">
        <WebhookForm ref="editForm" in-modal form-id="edit-webhook-form" :initial-url="webhook.url" :initial-events="webhook.eventTypes" :pending="update.isPending.value" :error="update.error.value?.message" @submit="update.mutate($event)" />
        <template #footer>
          <ModalActions action="Save changes" form="edit-webhook-form" :pending="update.isPending.value" :disabled="!editForm?.canSubmit" @cancel="editing = false" />
        </template>
      </FramedModal>

      <FramedModal v-model:open="rotateOpen" :title="rotated ? 'Copy the new secret' : 'Rotate the signing secret'" :description="rotated ? 'It’s shown only now.' : 'Get a new secret without dropping events: during the overlap, requests carry signatures from both.'" width="xl" :dismissible="!rotated">
        <SecretReveal v-if="rotated" title="New signing secret" :secret="rotated.signingSecret" :hint="rotated.previousSecretExpiresAt ? `The old secret keeps signing until ${new Date(rotated.previousSecretExpiresAt).toLocaleString()}.` : 'The old secret no longer signs requests.'" />
        <div v-else class="grid gap-3">
          <ChoiceCards v-model="overlapHours" name="overlap" legend="Keep the old secret working for" :options="overlapOptions" :columns="1" :disabled="rotate.isPending.value" />
          <p v-if="rotate.error.value" role="alert" class="m-0 text-sm text-red-600">{{ rotate.error.value.message }}</p>
        </div>
        <template #footer>
          <template v-if="rotated">
            <span />
            <UButton type="button" size="lg" class="rounded-md bg-atlair-950 px-4 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="rotateOpen = false">I’ve saved it</UButton>
          </template>
          <ModalActions v-else action="Rotate secret" :pending="rotate.isPending.value" @cancel="rotateOpen = false" @confirm="rotate.mutate()" />
        </template>
      </FramedModal>

      <ConfirmModal
        v-model:open="disableOpen"
        title="Disable this endpoint?"
        description="It stops receiving events, and deliveries still waiting are marked failed. You can enable it again any time."
        action="Disable"
        :pending="update.isPending.value"
        :error="update.error.value?.message"
        @confirm="update.mutate({ enabled: false }, { onSuccess: () => (disableOpen = false) })"
      />

      <ConfirmModal
        v-model:open="deleteOpen"
        title="Delete this endpoint?"
        :description="`${webhook.url} stops receiving events and its delivery history is removed.`"
        action="Delete endpoint"
        :pending="remove.isPending.value"
        :error="remove.error.value?.message"
        @confirm="remove.mutate()"
      />
    </template>
  </div>
</template>
