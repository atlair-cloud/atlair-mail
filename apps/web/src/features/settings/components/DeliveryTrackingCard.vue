<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { API_URL } from '../../../lib/api/client'
import { turnOnDeliveryEvents, type EventsMode } from '../api/provider'

const props = defineProps<{ organizationId: string; initialMode?: EventsMode; initialUrl?: string | null; cancellable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const mode = ref<EventsMode>(props.initialMode ?? 'pull')
const url = ref(props.initialUrl ?? (API_URL.startsWith('https://') ? API_URL : ''))

const options: { value: EventsMode; label: string; description: string }[] = [
  { value: 'pull', label: 'Check a queue', description: 'Works anywhere, even on your laptop. Results within about 10 minutes, and events are kept for 14 days if the worker is down.' },
  { value: 'push', label: 'Send to this server', description: 'Results within seconds. AWS calls your API, so it needs a public https address.' },
]

const trimmedUrl = computed(() => url.value.trim().replace(/\/+$/, ''))
const urlProblem = computed(() => (mode.value === 'push' && !/^https:\/\/[^\s?#]+$/.test(trimmedUrl.value) ? 'Enter the API’s public address, starting with https://' : null))
const showUrlProblem = ref(false)

const queryClient = useQueryClient()
const events = useMutation({
  mutationFn: () => turnOnDeliveryEvents(props.organizationId, mode.value === 'push' ? { mode: 'push', url: trimmedUrl.value } : { mode: 'pull' }),
  async onSuccess() {
    await queryClient.invalidateQueries({ queryKey: ['organizations', props.organizationId] })
    emit('done')
  },
})

function submit() {
  showUrlProblem.value = true
  if (urlProblem.value) return
  events.mutate()
}
</script>

<template>
  <form class="grid gap-4 rounded-md bg-white p-4 ring-1 ring-slate-200" novalidate @submit.prevent="submit">
    <div>
      <p class="m-0 text-sm font-medium text-slate-900">{{ cancellable ? 'Change how events arrive' : 'Turn on delivery tracking' }}</p>
      <p class="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">See which emails were delivered, bounced or marked as spam, and stop sending to addresses that bounce.</p>
    </div>

    <fieldset class="m-0 min-w-0 border-0 p-0" :disabled="events.isPending.value">
      <legend class="mb-2 p-0 text-xs font-medium text-slate-700">How events reach Atlair Mail</legend>
      <div class="divide-y divide-slate-200 overflow-hidden rounded-sm ring-1 ring-slate-200">
        <div v-for="option in options" :key="option.value" class="transition-colors motion-reduce:transition-none" :class="mode === option.value ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/60'">
          <label class="flex cursor-pointer items-start gap-3 px-3.5 py-3">
            <input v-model="mode" type="radio" name="events-mode" :value="option.value" class="peer sr-only" />
            <span
              aria-hidden="true"
              class="mt-0.5 size-4 shrink-0 rounded-full bg-white transition-[border-width,border-color] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-atlair-950 motion-reduce:transition-none"
              :class="mode === option.value ? 'border-[5px] border-atlair-950' : 'border border-slate-300'"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900">{{ option.label }}</span>
              <span class="mt-0.5 block text-xs leading-relaxed text-slate-600">{{ option.description }}</span>
            </span>
          </label>

          <div v-if="option.value === 'push' && mode === 'push'" class="px-3.5 pb-3.5">
            <div class="grid gap-1.5 pl-7">
              <label for="events-url" class="text-xs font-medium text-slate-700">Public API address</label>
              <input
                id="events-url"
                v-model="url"
                type="url"
                inputmode="url"
                autocomplete="off"
                spellcheck="false"
                placeholder="https://mail.example.com"
                :aria-invalid="showUrlProblem && !!urlProblem"
                :aria-describedby="showUrlProblem && urlProblem ? 'events-url-problem' : 'events-url-hint'"
                class="block h-9 w-full max-w-lg rounded-sm bg-white px-2.5 font-mono text-[13px] text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-slate-400 aria-[invalid=true]:ring-red-300"
              />
              <p v-if="showUrlProblem && urlProblem" id="events-url-problem" class="m-0 text-xs text-red-600">{{ urlProblem }}</p>
              <p v-else id="events-url-hint" class="m-0 text-xs leading-relaxed text-slate-500">
                Testing on your laptop? Run <code class="font-mono text-slate-700">cloudflared tunnel --url http://localhost:8080</code> and paste the address it prints.
              </p>
            </div>
          </div>
        </div>
      </div>
    </fieldset>

    <div class="flex flex-wrap items-center gap-2">
      <UButton type="submit" size="md" :loading="events.isPending.value" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900">
        {{ cancellable ? `Switch to ${mode === 'push' ? 'push' : 'queue'}` : 'Turn on tracking' }}
      </UButton>
      <UButton v-if="cancellable" type="button" size="md" color="neutral" variant="outline" class="h-9 rounded-sm bg-white px-3.5 text-sm font-medium text-slate-800 ring-slate-200 hover:bg-slate-100" @click="emit('cancel')">Cancel</UButton>
      <p v-if="events.error.value" role="alert" class="m-0 text-sm text-red-600">{{ events.error.value.message }}</p>
    </div>
  </form>
</template>
