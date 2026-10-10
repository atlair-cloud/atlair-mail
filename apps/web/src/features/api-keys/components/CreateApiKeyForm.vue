<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import AtlairSwitch from '../../../components/shared/AtlairSwitch.vue'
import { createApiKey, type CreatedApiKey } from '../api/api-keys'

const props = withDefaults(defineProps<{ organizationId: string; defaultName?: string; cancellable?: boolean; formId?: string; inModal?: boolean }>(), { defaultName: 'Production', cancellable: true, formId: 'create-api-key-form', inModal: false })
const emit = defineEmits<{ created: [key: CreatedApiKey]; cancel: [] }>()

const queryClient = useQueryClient()
const name = ref(props.defaultName)
const fullAccess = ref(false)

const create = useMutation({
  mutationFn: () => createApiKey(props.organizationId, { name: name.value.trim(), permission: fullAccess.value ? 'full_access' : 'sending_access' }),
  async onSuccess(key) {
    await queryClient.invalidateQueries({ queryKey: ['organizations', props.organizationId] })
    emit('created', key)
  },
})

const canSubmit = computed(() => name.value.trim() !== '')

function submit() {
  if (canSubmit.value && !create.isPending.value) create.mutate()
}

defineExpose({ pending: create.isPending, canSubmit })
</script>

<template>
  <form :id="formId" class="grid gap-4" novalidate @submit.prevent="submit">
    <div class="w-full" :class="inModal ? '' : 'max-w-sm'">
      <label for="api-key-name" class="block text-xs font-medium text-slate-700">Name</label>
      <UInput id="api-key-name" v-model="name" size="lg" maxlength="50" autofocus autocomplete="off" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white text-sm' }" :disabled="create.isPending.value" />
      <p class="m-0 mt-1.5 text-xs text-slate-500">Where it’s used, like “Production” or “Staging”.</p>
    </div>
    <div class="flex items-start justify-between gap-4 rounded-sm bg-white px-3.5 py-3 ring-1 ring-slate-200">
      <label for="api-key-full-access" class="min-w-0 cursor-pointer">
        <span class="block text-sm font-medium text-slate-900">Full access</span>
        <span class="mt-0.5 block text-xs leading-relaxed text-slate-500">
          {{ fullAccess ? 'Can send, and manage domains, keys, webhooks and the provider.' : 'Off: this key can only send emails and read their status. Right for your app.' }}
        </span>
      </label>
      <AtlairSwitch id="api-key-full-access" v-model="fullAccess" :disabled="create.isPending.value" class="mt-0.5" />
    </div>
    <div v-if="!inModal" class="flex flex-wrap items-center gap-3">
      <UButton type="submit" size="md" :loading="create.isPending.value" :disabled="!name.trim()" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">Create key</UButton>
      <button v-if="cancellable" type="button" class="rounded-sm px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" @click="emit('cancel')"><slot name="cancel">Cancel</slot></button>
    </div>
    <p v-if="create.error.value" role="alert" class="m-0 text-sm text-red-600">{{ create.error.value.message }}</p>
  </form>
</template>
