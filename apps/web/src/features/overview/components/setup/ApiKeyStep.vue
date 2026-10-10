<script setup lang="ts">
import { computed, ref } from 'vue'
import SecretReveal from '../../../../components/shared/SecretReveal.vue'
import { CreateApiKeyForm, type CreatedApiKey } from '../../../api-keys'
import type { Overview } from '../../api/get-overview'

const props = defineProps<{ organizationId: string; overview: Overview; created: CreatedApiKey | null }>()
const emit = defineEmits<{ created: [key: CreatedApiKey] }>()

const creatingAnother = ref(false)
const showForm = computed(() => (props.overview.setup.apiKeys === 0 && !props.created) || creatingAnother.value)

function onCreated(key: CreatedApiKey) {
  creatingAnother.value = false
  emit('created', key)
}
</script>

<template>
  <div class="grid gap-4">
    <SecretReveal
      v-if="created && !creatingAnother"
      :title="`“${created.name}” is ready. Copy it now: it won’t be shown again.`"
      :secret="created.token"
      hint="Store it as ATLAIR_MAIL_API_KEY in your app’s environment. The next step already uses it."
    />
    <CreateApiKeyForm v-if="showForm" :organization-id="organizationId" :cancellable="creatingAnother" @created="onCreated" @cancel="creatingAnother = false" />
    <p v-else-if="!created" class="m-0 text-sm text-slate-600">
      You have {{ overview.setup.apiKeys }} active {{ overview.setup.apiKeys === 1 ? 'key' : 'keys' }}.
      <button type="button" class="rounded-sm font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800" @click="creatingAnother = true">Create another</button>
    </p>
  </div>
</template>
