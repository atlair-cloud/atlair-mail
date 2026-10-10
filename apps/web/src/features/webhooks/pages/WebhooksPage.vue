<script setup lang="ts">
import { BellNotification, NavArrowRight, Plus } from '@iconoir/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../../components/shared/EmptyState.vue'
import FramedModal from '../../../components/shared/FramedModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import SecretReveal from '../../../components/shared/SecretReveal.vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { useCurrentOrganization } from '../../organizations'
import { createWebhook, listWebhooks, webhooksQueryKey, type WebhookEventType, type WebhookWithSecret } from '../api/webhooks'
import VerifyGuide from '../components/VerifyGuide.vue'
import WebhookForm from '../components/WebhookForm.vue'
import { eventLabel } from '../lib/event-types'

const router = useRouter()
const queryClient = useQueryClient()
const { organizationId, canManage } = useCurrentOrganization()

const query = useQuery({
  queryKey: computed(() => webhooksQueryKey(organizationId.value)),
  queryFn: () => listWebhooks(organizationId.value),
})
const webhooks = computed(() => query.data.value ?? [])

const creating = ref(false)
const created = ref<WebhookWithSecret | null>(null)
const createForm = useTemplateRef<{ canSubmit: boolean }>('createForm')

const create = useMutation({
  mutationFn: (input: { url: string; eventTypes: WebhookEventType[] }) => createWebhook(organizationId.value, input),
  async onSuccess(webhook) {
    created.value = webhook
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })
  },
})

function openCreate() {
  created.value = null
  create.reset()
  creating.value = true
}

function finish() {
  const id = created.value?.id
  creating.value = false
  if (id) router.push({ name: 'webhook', params: { organizationId: organizationId.value, webhookId: id } })
}

function summary(eventTypes: WebhookEventType[]) {
  const labels = eventTypes.map(eventLabel)
  return labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ')
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Webhooks" title="Get told when things happen" description="Atlair Mail POSTs a signed event to your endpoint when an email is delivered, bounces, gets a complaint, or fails, so your app can react without polling.">
      <template v-if="canManage && webhooks.length" #actions>
        <UButton type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="openCreate">
          <Plus aria-hidden="true" class="size-4" />Add endpoint
        </UButton>
      </template>
    </PageHeader>

    <div v-if="query.isPending.value" class="mt-8 grid gap-3" aria-busy="true" aria-label="Loading webhooks">
      <div v-for="n in 2" :key="n" class="skeleton-card h-20 rounded-md ring-1 ring-slate-200" />
    </div>

    <LoadErrorCard v-else-if="query.isError.value" class="mt-8" :error="query.error.value" subject="your webhooks" @retry="query.refetch()" />

    <EmptyState v-else-if="webhooks.length === 0" class="mt-8" title="No endpoints yet" description="Add an https endpoint in your app and choose which events to receive.">
      <template #icon><BellNotification class="size-5" /></template>
      <UButton v-if="canManage" type="button" size="md" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900" @click="openCreate">
        <Plus aria-hidden="true" class="size-4" />Add an endpoint
      </UButton>
      <p v-else class="m-0 text-xs text-slate-500">An owner or admin can add endpoints.</p>
    </EmptyState>

    <ul v-else class="m-0 mt-8 grid list-none gap-3 p-0">
      <li v-for="webhook in webhooks" :key="webhook.id" class="relative">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-white px-5 py-4 ring-1 ring-slate-200 transition-shadow hover:ring-slate-300 motion-reduce:transition-none">
          <div class="min-w-0 flex-1">
            <RouterLink
              :to="{ name: 'webhook', params: { organizationId, webhookId: webhook.id } }"
              class="block truncate font-mono text-sm font-medium text-slate-900 outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-atlair-950"
            >{{ webhook.url }}</RouterLink>
            <p class="m-0 mt-1 truncate text-xs text-slate-500">{{ summary(webhook.eventTypes) }} · added {{ formatRelativeTime(webhook.createdAt) }}</p>
          </div>
          <span class="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <span aria-hidden="true" class="size-2 rounded-full" :class="webhook.enabled ? 'bg-status-live' : 'bg-slate-300'" />{{ webhook.enabled ? 'Enabled' : 'Disabled' }}
          </span>
          <NavArrowRight aria-hidden="true" class="size-4 text-slate-400" />
        </div>
      </li>
    </ul>

    <section v-if="!query.isPending.value && !query.isError.value" class="mt-10 rounded-md bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
      <h2 class="m-0 mb-2 text-sm font-semibold text-slate-900">Receiving events</h2>
      <VerifyGuide />
    </section>

    <FramedModal
      v-model:open="creating"
      :title="created ? 'Copy the signing secret' : 'Add a webhook endpoint'"
      :description="created ? 'Your endpoint uses it to check that requests come from Atlair Mail. It’s shown only now.' : 'Events are sent as they happen, signed with a secret only you and Atlair Mail know.'"
      width="xl"
      :dismissible="!created"
    >
      <SecretReveal v-if="created" title="Signing secret" :secret="created.signingSecret" hint="Store it as ATLAIR_WEBHOOK_SECRET. You can rotate it later from the endpoint’s page." />
      <WebhookForm v-else ref="createForm" in-modal form-id="create-webhook-form" :pending="create.isPending.value" :error="create.error.value?.message" @submit="create.mutate($event)" />
      <template #footer>
        <template v-if="created">
          <span />
          <UButton type="button" size="lg" class="rounded-md bg-atlair-950 px-4 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="finish">I’ve saved it, open the endpoint</UButton>
        </template>
        <ModalActions v-else action="Add endpoint" form="create-webhook-form" :pending="create.isPending.value" :disabled="!createForm?.canSubmit" @cancel="creating = false" />
      </template>
    </FramedModal>
  </div>
</template>
