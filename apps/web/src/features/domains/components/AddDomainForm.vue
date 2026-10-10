<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { addDomain, domainQueryKey, type Domain } from '../api/domains'

const props = withDefaults(defineProps<{ organizationId: string; formId?: string; inModal?: boolean }>(), { formId: 'add-domain-form', inModal: false })
const emit = defineEmits<{ created: [domain: Domain] }>()

const queryClient = useQueryClient()
const name = ref('')

const add = useMutation({
  mutationFn: () => addDomain(props.organizationId, name.value.trim().toLowerCase()),
  async onSuccess(created) {
    queryClient.setQueryData(domainQueryKey(props.organizationId, created.id), created)
    name.value = ''
    await queryClient.invalidateQueries({ queryKey: ['organizations', props.organizationId] })
    emit('created', created)
  },
})

const validName = computed(() => /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(name.value.trim()))

function submit() {
  if (validName.value && !add.isPending.value) add.mutate()
}

defineExpose({ pending: add.isPending, canSubmit: validName })
</script>

<template>
  <form :id="formId" class="grid gap-3" novalidate @submit.prevent="submit">
    <p class="m-0 max-w-2xl text-sm leading-relaxed text-slate-600">
      Use a domain you control. A subdomain like <span class="font-mono text-slate-800">mail.yourcompany.com</span> keeps email reputation separate from your main domain.
    </p>
    <div class="flex flex-wrap items-end gap-3">
      <div class="w-full" :class="inModal ? '' : 'max-w-sm'">
        <label for="domain-name" class="block text-xs font-medium text-slate-700">Domain</label>
        <UInput id="domain-name" v-model="name" size="lg" autofocus autocomplete="off" spellcheck="false" placeholder="mail.yourcompany.com" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="add.isPending.value" />
      </div>
      <UButton v-if="!inModal" type="submit" size="md" :loading="add.isPending.value" :disabled="!validName" class="h-10 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">Add domain</UButton>
    </div>
    <p v-if="add.error.value" role="alert" class="m-0 text-sm text-red-600">{{ add.error.value.message }}</p>
  </form>
</template>
