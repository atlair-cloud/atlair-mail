<script setup lang="ts">
import { computed, ref } from 'vue'
import AtlairSwitch from '../../../components/shared/AtlairSwitch.vue'
import type { WebhookEventType } from '../api/webhooks'
import { RECOMMENDED_EVENTS, WEBHOOK_EVENTS } from '../lib/event-types'

const props = withDefaults(
  defineProps<{ initialUrl?: string; initialEvents?: WebhookEventType[]; submitLabel?: string; pending: boolean; error?: string; formId?: string; inModal?: boolean }>(),
  { initialUrl: '', initialEvents: () => [...RECOMMENDED_EVENTS], error: '', submitLabel: 'Save', formId: 'webhook-form', inModal: false },
)
const emit = defineEmits<{ submit: [value: { url: string; eventTypes: WebhookEventType[] }] }>()

const url = ref(props.initialUrl)
const events = ref<WebhookEventType[]>([...props.initialEvents])

const validUrl = computed(() => /^https:\/\/[^\s?#]+\.[^\s?#]+/.test(url.value.trim()))
const urlHint = computed(() => (url.value.trim() && !url.value.trim().startsWith('https://') ? 'Use an https:// address.' : ''))
const canSubmit = computed(() => validUrl.value && events.value.length > 0)

function setEvent(value: WebhookEventType, on: boolean) {
  events.value = on ? [...new Set([...events.value, value])] : events.value.filter((event) => event !== value)
}

function submit() {
  if (canSubmit.value && !props.pending) emit('submit', { url: url.value.trim(), eventTypes: events.value })
}

defineExpose({ canSubmit })
</script>

<template>
  <form :id="formId" class="grid gap-5" novalidate @submit.prevent="submit">
    <div>
      <label for="webhook-url" class="block text-xs font-medium text-slate-700">Endpoint URL</label>
      <UInput id="webhook-url" v-model="url" type="url" size="lg" autofocus autocomplete="off" spellcheck="false" placeholder="https://yourapp.com/webhooks/atlair-mail" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white font-mono text-sm' }" :disabled="pending" />
      <p class="m-0 mt-1.5 text-xs" :class="urlHint ? 'text-red-600' : 'text-slate-500'">{{ urlHint || 'A public https address. Each event is POSTed as signed JSON.' }}</p>
    </div>

    <fieldset class="m-0 border-0 p-0">
      <div class="mb-2 flex items-center justify-between gap-3">
        <legend class="text-xs font-medium text-slate-700">Events</legend>
        <span class="flex gap-3 text-xs">
          <button type="button" class="rounded-sm font-medium text-slate-600 hover:text-slate-900" @click="events = [...RECOMMENDED_EVENTS]">Recommended</button>
          <button type="button" class="rounded-sm font-medium text-slate-600 hover:text-slate-900" @click="events = WEBHOOK_EVENTS.map((event) => event.value)">All</button>
        </span>
      </div>
      <ul class="m-0 list-none divide-y divide-slate-100 overflow-hidden rounded-sm bg-white p-0 ring-1 ring-slate-200">
        <li v-for="event in WEBHOOK_EVENTS" :key="event.value" class="flex items-center justify-between gap-4 px-3.5 py-2.5">
          <label :for="`event-${event.value}`" class="min-w-0 cursor-pointer">
            <span class="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-slate-900">{{ event.label }}<span class="font-mono text-[11px] font-normal text-slate-400">{{ event.value }}</span></span>
            <span class="block text-xs text-slate-500">{{ event.description }}</span>
          </label>
          <AtlairSwitch :id="`event-${event.value}`" :model-value="events.includes(event.value)" :disabled="pending" @update:model-value="setEvent(event.value, $event)" />
        </li>
      </ul>
      <p v-if="events.length === 0" class="m-0 mt-2 text-xs text-red-600">Choose at least one event.</p>
    </fieldset>

    <div v-if="!inModal" class="flex flex-wrap items-center gap-3">
      <UButton type="submit" size="md" :loading="pending" :disabled="!canSubmit" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900 disabled:opacity-40">{{ submitLabel }}</UButton>
      <slot name="secondary" />
    </div>
    <p v-if="error" role="alert" class="m-0 text-sm text-red-600">{{ error }}</p>
  </form>
</template>
