<script setup lang="ts">
import { Globe, NavArrowDown, OpenNewWindow, Send } from '@iconoir/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import EmptyState from '../../../components/shared/EmptyState.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import PageHeader from '../../../components/shared/PageHeader.vue'
import { API_DOCS_URL } from '../../../lib/links'
import { getMe, meQueryKey } from '../../auth'
import { domainsQueryKey, listDomains } from '../../domains'
import { useCurrentOrganization } from '../../organizations'
import { getOverview, overviewQueryKey } from '../../overview/api/get-overview'
import { sendEmail, type SendEmailBody } from '../api/send-email'
import CodeTabs from '../components/CodeTabs.vue'
import PlaygroundSend from '../components/PlaygroundSend.vue'

const queryClient = useQueryClient()
const { organizationId, organization } = useCurrentOrganization()
const { data: me } = useQuery({ queryKey: meQueryKey, queryFn: getMe })
const domainsQuery = useQuery({
  queryKey: computed(() => domainsQueryKey(organizationId.value)),
  queryFn: () => listDomains(organizationId.value),
})
const { data: overview } = useQuery({
  queryKey: computed(() => overviewQueryKey(organizationId.value)),
  queryFn: () => getOverview(organizationId.value),
  staleTime: 60_000,
})

const verified = computed(() => (domainsQuery.data.value ?? []).filter((domain) => domain.status === 'verified').map((domain) => domain.name))
const sandbox = computed(() => overview.value?.setup.provider.account?.sandbox ?? false)
const tracking = computed(() => overview.value?.setup.provider.eventsConnected ?? false)

const fromName = ref('')
const fromLocal = ref('hello')
const fromDomain = ref('')
const to = ref('')
const subject = ref('Hello from Atlair Mail')
const format = ref<'text' | 'html'>('text')
const text = ref('This email was sent from the Atlair Mail playground.\n\nIf you can read it, sending works.')
const html = ref('<h1>Hello</h1>\n<p>This email was sent from the <strong>Atlair Mail</strong> playground.</p>')
const replyTo = ref('')
const tags = ref('')
const advanced = ref(false)

watch(verified, (names) => {
  if (!names.includes(fromDomain.value)) fromDomain.value = names[0] ?? ''
}, { immediate: true })
watch(organization, (value) => {
  if (!fromName.value && value) fromName.value = value.name
}, { immediate: true })
watch(me, (value) => {
  if (!to.value && value) to.value = value.email
}, { immediate: true })

const presets = computed(() => [
  ...(me.value ? [{ label: 'Me', address: me.value.email, hint: 'Your own address. In the sandbox it must be verified in SES.' }] : []),
  { label: 'Delivered', address: 'success@simulator.amazonses.com', hint: 'Amazon’s simulator accepts it and reports a delivery. Works in the sandbox.' },
  { label: 'Bounce', address: 'bounce@simulator.amazonses.com', hint: 'Simulates a hard bounce; the address is then suppressed for this organization.' },
  { label: 'Complaint', address: 'complaint@simulator.amazonses.com', hint: 'Simulates a spam complaint.' },
  { label: 'Out of office', address: 'ooto@simulator.amazonses.com', hint: 'Delivered, with an automatic reply.' },
])

const split = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean)

const body = computed<SendEmailBody>(() => {
  const local = fromLocal.value.trim() || 'hello'
  const address = `${local}@${fromDomain.value || 'yourdomain.com'}`
  const name = fromName.value.trim().replace(/[<>"]/g, '')
  const parsedTags = split(tags.value).map((entry) => {
    const [tagName = '', ...rest] = entry.split('=')
    return { name: tagName.trim(), value: rest.join('=').trim() }
  }).filter((tag) => tag.name && tag.value)
  return {
    from: name ? `${name} <${address}>` : address,
    to: split(to.value),
    subject: subject.value,
    ...(format.value === 'html' ? { html: html.value } : { text: text.value }),
    ...(split(replyTo.value).length ? { replyTo: split(replyTo.value) } : {}),
    ...(parsedTags.length ? { tags: parsedTags } : {}),
  }
})

const call = computed(() => ({ method: 'POST', path: '/emails', body: body.value }))

const problem = computed(() => {
  if (!fromDomain.value) return 'Pick a verified domain to send from.'
  if (body.value.to.length === 0) return 'Add at least one recipient.'
  if (!subject.value.trim()) return 'Add a subject.'
  if (!(format.value === 'html' ? html.value : text.value).trim()) return 'Write something in the body.'
  return null
})

const sends = ref<{ id: string; to: string[]; subject: string; sentAt: string }[]>([])
const send = useMutation({
  mutationFn: () => sendEmail(organizationId.value, body.value),
  async onSuccess(email) {
    sends.value = [{ id: email.id, to: body.value.to, subject: body.value.subject, sentAt: email.createdAt }, ...sends.value].slice(0, 8)
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value, 'emails'] })
    await queryClient.invalidateQueries({ queryKey: overviewQueryKey(organizationId.value) })
  },
})

const field = 'mt-1.5 w-full'
const input = { base: 'h-10 rounded-sm bg-white text-sm' }
</script>

<template>
  <div>
    <PageHeader eyebrow="Playground" title="Try the API" description="Build an email, see the exact request your app would make, and send it from here. Sends use your session, so no API key is needed." />

    <div v-if="domainsQuery.isPending.value" class="mt-8 grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading the playground">
      <div class="skeleton-card h-[28rem] rounded-md ring-1 ring-slate-200" />
      <div class="skeleton-card h-72 rounded-md ring-1 ring-slate-200" />
    </div>

    <LoadErrorCard v-else-if="domainsQuery.isError.value" class="mt-8" :error="domainsQuery.error.value" subject="your domains" @retry="domainsQuery.refetch()" />

    <EmptyState v-else-if="verified.length === 0" class="mt-8" title="Verify a domain first" description="Emails are sent from a verified domain. Once one is verified, you can try sending here.">
      <template #icon><Globe class="size-5" /></template>
      <RouterLink :to="{ name: 'domains', params: { organizationId } }" class="inline-flex h-9 items-center rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900">Go to domains</RouterLink>
    </EmptyState>

    <div v-else class="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200" novalidate @submit.prevent="!problem && send.mutate()">
        <div class="grid gap-4 px-5 py-5">
          <div>
            <span class="block text-xs font-medium text-slate-700">From</span>
            <div class="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] items-center gap-x-1.5 gap-y-2">
              <UInput v-model="fromName" aria-label="Sender name" placeholder="Name" size="lg" class="col-span-3 w-full" :ui="input" />
              <UInput v-model="fromLocal" aria-label="Sender address" size="lg" autocomplete="off" class="w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" />
              <span aria-hidden="true" class="font-mono text-sm text-slate-500">@</span>
              <USelect v-model="fromDomain" aria-label="Sending domain" :items="verified" size="lg" class="w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" />
            </div>
          </div>

          <div>
            <label for="playground-to" class="block text-xs font-medium text-slate-700">To</label>
            <UInput id="playground-to" v-model="to" size="lg" placeholder="ada@example.com, grace@example.com" autocomplete="off" :class="field" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" />
            <div class="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick recipients">
              <UTooltip v-for="preset in presets" :key="preset.address" :text="preset.hint" :content="{ side: 'top' }">
                <button
                  type="button"
                  class="rounded-sm px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-atlair-950 motion-reduce:transition-none"
                  :class="to === preset.address ? 'bg-atlair-950 text-canvas ring-atlair-950' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'"
                  :aria-pressed="to === preset.address"
                  @click="to = preset.address"
                >{{ preset.label }}</button>
              </UTooltip>
            </div>
            <p v-if="sandbox" class="m-0 mt-2 text-xs leading-relaxed text-amber-800">Your SES account is in the sandbox: only addresses verified in SES and Amazon’s simulator addresses receive email.</p>
          </div>

          <div>
            <label for="playground-subject" class="block text-xs font-medium text-slate-700">Subject</label>
            <UInput id="playground-subject" v-model="subject" size="lg" maxlength="998" :class="field" :ui="input" />
          </div>

          <div>
            <div class="flex items-center justify-between gap-3">
              <label :for="`playground-${format}`" class="block text-xs font-medium text-slate-700">Body</label>
              <div role="tablist" aria-label="Body format" class="flex gap-0.5 rounded-sm bg-slate-100 p-0.5">
                <button
                  v-for="option in (['text', 'html'] as const)"
                  :key="option"
                  type="button"
                  role="tab"
                  :aria-selected="format === option"
                  class="rounded-[3px] px-2 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-atlair-950"
                  :class="format === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
                  @click="format = option"
                >{{ option === 'text' ? 'Text' : 'HTML' }}</button>
              </div>
            </div>
            <UTextarea v-if="format === 'text'" id="playground-text" v-model="text" :rows="6" autoresize :class="field" :ui="{ base: 'rounded-sm bg-white text-sm' }" />
            <UTextarea v-else id="playground-html" v-model="html" :rows="6" autoresize :class="field" :ui="{ base: 'rounded-sm bg-white font-mono text-[13px]' }" />
          </div>

          <div>
            <button type="button" class="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950" :aria-expanded="advanced" @click="advanced = !advanced">
              <NavArrowDown aria-hidden="true" class="size-3.5 transition-transform motion-reduce:transition-none" :class="advanced ? '' : '-rotate-90'" />Reply-to and tags
            </button>
            <div v-if="advanced" class="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label for="playground-reply-to" class="block text-xs font-medium text-slate-700">Reply-to</label>
                <UInput id="playground-reply-to" v-model="replyTo" size="lg" placeholder="support@example.com" autocomplete="off" :class="field" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" />
              </div>
              <div>
                <label for="playground-tags" class="block text-xs font-medium text-slate-700">Tags</label>
                <UInput id="playground-tags" v-model="tags" size="lg" placeholder="category=welcome" autocomplete="off" :class="field" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <p class="m-0 text-xs" :class="send.error.value ? 'text-red-600' : 'text-slate-500'" :role="send.error.value ? 'alert' : undefined">
            {{ send.error.value?.message ?? problem ?? 'Sends as you, from this organization.' }}
          </p>
          <UButton type="submit" size="md" :loading="send.isPending.value" :disabled="!!problem" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">
            <Send v-if="!send.isPending.value" aria-hidden="true" class="size-4" />Send email
          </UButton>
        </div>
      </form>

      <div class="grid min-w-0 gap-6">
        <section aria-labelledby="request-heading" class="min-w-0">
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="request-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Request</h2>
            <a :href="API_DOCS_URL" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">API docs<OpenNewWindow aria-hidden="true" class="size-3" /></a>
          </div>
          <CodeTabs :call="call" label="Request language" />
          <p class="m-0 mt-2 text-xs text-slate-500">
            Set <span class="font-mono text-slate-700">ATLAIR_MAIL_API_KEY</span> to a key from
            <RouterLink :to="{ name: 'api-keys', params: { organizationId } }" class="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">API keys</RouterLink>.
          </p>
        </section>

        <section aria-labelledby="sent-heading" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
          <header class="border-b border-slate-100 px-4 py-2.5">
            <h2 id="sent-heading" class="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Sent from here</h2>
          </header>
          <p v-if="sends.length === 0" class="m-0 px-4 py-6 text-center text-sm text-slate-500">Emails you send show up here and update as they’re delivered.</p>
          <ol v-else class="m-0 list-none divide-y divide-slate-100 p-0">
            <PlaygroundSend v-for="sent in sends" :key="sent.id" :organization-id="organizationId" :email-id="sent.id" :to="sent.to" :subject="sent.subject" :sent-at="sent.sentAt" :tracking="tracking" :sandbox="sandbox" />
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>
