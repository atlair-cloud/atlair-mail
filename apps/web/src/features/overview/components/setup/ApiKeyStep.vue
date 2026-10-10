<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import CopyButton from '../../../../components/shared/CopyButton.vue'
import { createApiKey, type ApiKeyPermission, type CreatedApiKey } from '../../api/api-keys'
import { overviewQueryKey, type Overview } from '../../api/get-overview'

const props = defineProps<{ organizationId: string; overview: Overview; created: CreatedApiKey | null }>()
const emit = defineEmits<{ created: [key: CreatedApiKey] }>()

const queryClient = useQueryClient()
const name = ref('Production')
const permission = ref<ApiKeyPermission>('sending_access')
const creatingAnother = ref(false)

const permissions: { value: ApiKeyPermission; label: string; description: string }[] = [
  { value: 'sending_access', label: 'Sending only', description: 'Can send emails and read their status. Right for your app.' },
  { value: 'full_access', label: 'Full access', description: 'Can also manage domains, keys, webhooks and the provider.' },
]

const create = useMutation({
  mutationFn: () => createApiKey(props.organizationId, { name: name.value.trim(), permission: permission.value }),
  async onSuccess(key) {
    emit('created', key)
    creatingAnother.value = false
    await queryClient.invalidateQueries({ queryKey: overviewQueryKey(props.organizationId) })
  },
})

const showForm = computed(() => (props.overview.setup.apiKeys === 0 && !props.created) || creatingAnother.value)

function submit() {
  if (name.value.trim() && !create.isPending.value) create.mutate()
}
</script>

<template>
  <div class="grid gap-4">
    <div v-if="created && !creatingAnother" class="rounded-md bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
      <p class="m-0 text-sm font-medium text-slate-900">“{{ created.name }}” is ready. Copy it now: it won’t be shown again.</p>
      <div class="mt-2.5 flex items-center gap-2 rounded-sm bg-white px-3 py-2 ring-1 ring-slate-200">
        <code class="min-w-0 flex-1 truncate font-mono text-xs text-slate-900">{{ created.token }}</code>
        <CopyButton :value="created.token" />
      </div>
      <p class="m-0 mt-2 text-xs text-slate-600">Store it as <span class="font-mono text-slate-800">ATLAIR_MAIL_API_KEY</span> in your app’s environment. The next step already uses it.</p>
    </div>

    <form v-if="showForm" class="grid gap-4" novalidate @submit.prevent="submit">
      <div class="w-full max-w-sm">
        <label for="api-key-name" class="block text-xs font-medium text-slate-700">Name</label>
        <UInput id="api-key-name" v-model="name" size="lg" maxlength="50" autocomplete="off" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white text-sm' }" :disabled="create.isPending.value" />
      </div>
      <fieldset class="m-0 grid gap-2 border-0 p-0 sm:grid-cols-2">
        <legend class="mb-1.5 text-xs font-medium text-slate-700">Permission</legend>
        <label
          v-for="option in permissions"
          :key="option.value"
          class="flex cursor-pointer items-start gap-3 rounded-md bg-white px-3.5 py-3 ring-1 transition-shadow"
          :class="permission === option.value ? 'ring-2 ring-atlair-950' : 'ring-slate-200 hover:ring-slate-300'"
        >
          <input v-model="permission" type="radio" name="api-key-permission" :value="option.value" class="mt-0.5 accent-[var(--color-atlair-950)]" />
          <span>
            <span class="block text-sm font-medium text-slate-900">{{ option.label }}</span>
            <span class="block text-xs leading-relaxed text-slate-500">{{ option.description }}</span>
          </span>
        </label>
      </fieldset>
      <div class="flex flex-wrap items-center gap-3">
        <UButton type="submit" size="md" :loading="create.isPending.value" :disabled="!name.trim()" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">Create key</UButton>
        <button v-if="creatingAnother" type="button" class="rounded-sm px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" @click="creatingAnother = false">Cancel</button>
      </div>
      <p v-if="create.error.value" role="alert" class="m-0 text-sm text-red-600">{{ create.error.value.message }}</p>
    </form>

    <p v-else-if="!created" class="m-0 text-sm text-slate-600">
      You have {{ overview.setup.apiKeys }} active {{ overview.setup.apiKeys === 1 ? 'key' : 'keys' }}.
      <button type="button" class="rounded-sm font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800" @click="creatingAnother = true">Create another</button>
    </p>
  </div>
</template>
