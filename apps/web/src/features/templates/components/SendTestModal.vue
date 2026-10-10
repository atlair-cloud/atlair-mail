<script setup lang="ts">
import { useMutation, useQuery } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FramedModal from '../../../components/shared/FramedModal.vue'
import ModalActions from '../../../components/shared/ModalActions.vue'
import { apiFetch } from '../../../lib/api/client'
import { getMe, meQueryKey } from '../../auth'
import { domainsQueryKey, listDomains } from '../../domains'
import type { TemplateVariable, VariableValues } from '../api/templates'
import { sampleValues } from '../lib/variables'

const props = defineProps<{ organizationId: string; templateId: string; variables: TemplateVariable[]; samples: VariableValues }>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const toast = useToast()
const { data: me } = useQuery({ queryKey: meQueryKey, queryFn: getMe })
const domains = useQuery({ queryKey: computed(() => domainsQueryKey(props.organizationId)), queryFn: () => listDomains(props.organizationId) })
const verified = computed(() => (domains.data.value ?? []).filter((domain) => domain.status === 'verified').map((domain) => domain.name))

const to = ref('')
const fromDomain = ref('')
const values = ref<VariableValues>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  to.value = to.value || me.value?.email || ''
  values.value = { ...props.samples }
  send.reset()
})

watch(
  verified,
  (names) => {
    if (!names.includes(fromDomain.value)) fromDomain.value = names[0] ?? ''
  },
  { immediate: true },
)

const required = computed(() => props.variables.filter((variable) => variable.fallback === undefined))
const missing = computed(() => required.value.filter((variable) => String(values.value[variable.key] ?? '').trim() === '').map((variable) => variable.key))
const validTo = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.value.trim()))
const canSend = computed(() => validTo.value && Boolean(fromDomain.value) && missing.value.length === 0)

const send = useMutation({
  mutationFn: () =>
    apiFetch<{ id: string }>(`/organizations/${props.organizationId}/emails`, {
      method: 'POST',
      body: JSON.stringify({
        from: `test@${fromDomain.value}`,
        to: [to.value.trim()],
        template: { id: props.templateId, variables: sampleValues(props.variables, values.value), version: 'draft' },
        tags: [{ name: 'source', value: 'template_test' }],
      }),
    }),
  onSuccess(email) {
    open.value = false
    toast.add({
      title: 'Test email queued',
      description: `Sending to ${to.value.trim()}.`,
      color: 'neutral',
      actions: [{ label: 'View email', variant: 'outline', color: 'neutral', onClick: () => router.push({ name: 'email', params: { organizationId: props.organizationId, emailId: email.id } }) }],
    })
  },
})

const inputClass = 'h-9 w-full rounded-sm bg-white px-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-slate-400'
</script>

<template>
  <FramedModal v-model:open="open" title="Send a test" description="Sends the saved draft, published or not, with these values." width="xl">
    <p v-if="domains.isSuccess.value && verified.length === 0" class="m-0 rounded-sm bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
      Verify a sending domain first.
      <RouterLink :to="{ name: 'domains', params: { organizationId } }" class="font-medium underline underline-offset-2">Go to domains</RouterLink>
    </p>
    <form v-else id="send-test-form" class="grid gap-4" novalidate @submit.prevent="canSend && send.mutate()">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label for="send-test-to" class="block text-xs font-medium text-slate-700">To</label>
          <input id="send-test-to" v-model="to" type="email" autocomplete="email" :class="[inputClass, 'mt-1.5']" placeholder="you@example.com" />
        </div>
        <div>
          <label for="send-test-from" class="block text-xs font-medium text-slate-700">From</label>
          <div class="mt-1.5 flex items-center gap-1.5">
            <span class="shrink-0 font-mono text-xs text-slate-500">test@</span>
            <USelect id="send-test-from" v-model="fromDomain" :items="verified" class="min-w-0 flex-1" :ui="{ base: 'h-9 rounded-sm bg-white font-mono text-xs' }" />
          </div>
        </div>
      </div>
      <fieldset v-if="variables.length" class="m-0 grid gap-2 border-0 p-0">
        <legend class="mb-1.5 text-xs font-medium text-slate-700">Values</legend>
        <div v-for="variable in variables" :key="variable.key" class="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-2">
          <label :for="`send-test-${variable.key}`" class="truncate font-mono text-xs text-slate-600">{{ variable.key }}<span v-if="variable.fallback === undefined" class="text-red-500" aria-label="required">*</span></label>
          <input
            :id="`send-test-${variable.key}`"
            v-model="values[variable.key]"
            :class="[inputClass, 'h-8 text-xs']"
            :inputmode="variable.type === 'number' ? 'decimal' : undefined"
            :placeholder="variable.fallback !== undefined ? `Fallback: ${variable.fallback}` : 'Required'"
          />
        </div>
      </fieldset>
      <p v-if="send.error.value" role="alert" class="m-0 text-sm text-red-600">{{ send.error.value.message }}</p>
    </form>
    <template #footer>
      <ModalActions action="Send test" form="send-test-form" :pending="send.isPending.value" :disabled="!canSend" @cancel="open = false" />
    </template>
  </FramedModal>
</template>
