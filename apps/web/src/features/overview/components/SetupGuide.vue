<script setup lang="ts">
import { Check, Lock, NavArrowDown } from '@iconoir/vue'
import { computed, ref, watch } from 'vue'
import type { CreatedApiKey } from '../api/api-keys'
import type { Overview } from '../api/get-overview'
import { setupSteps, type SetupStepKey } from '../lib/setup'
import ApiKeyStep from './setup/ApiKeyStep.vue'
import DomainStep from './setup/DomainStep.vue'
import FirstEmailStep from './setup/FirstEmailStep.vue'
import ProviderStep from './setup/ProviderStep.vue'

const props = defineProps<{
  organizationId: string
  overview: Overview
  canManage: boolean
  recipient: string | null
  sendingDomain: string | null
  sendingTest: boolean
  testSentTo: string | null
  testError: string
}>()
const emit = defineEmits<{ sendTest: [to: string] }>()

const steps = computed(() => setupSteps(props.overview))
const currentKey = computed(() => steps.value.find((step) => !step.done)?.key ?? null)
const doneCount = computed(() => steps.value.filter((step) => step.done).length)

const openKey = ref<SetupStepKey | null>(currentKey.value)
watch(currentKey, (key) => {
  openKey.value = key
})

const createdKey = ref<CreatedApiKey | null>(null)

function toggle(key: SetupStepKey) {
  openKey.value = openKey.value === key ? null : key
}

const needsManager = (key: SetupStepKey) => key !== 'first-email'
</script>

<template>
  <section aria-labelledby="setup-heading" class="overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 id="setup-heading" class="m-0 text-base font-semibold text-slate-900">Get sending</h2>
        <p class="m-0 mt-0.5 text-sm text-slate-500">Four steps, about ten minutes. Most of the waiting is DNS.</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono text-[11px] tabular-nums text-slate-600">{{ doneCount }}/{{ steps.length }}</span>
        <span aria-hidden="true" class="flex h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
          <span class="bg-status-live transition-[width] duration-500 motion-reduce:transition-none" :style="{ width: `${(doneCount / steps.length) * 100}%` }" />
        </span>
      </div>
    </header>

    <ol class="m-0 list-none divide-y divide-slate-100 p-0">
      <li v-for="(step, index) in steps" :key="step.key" :class="openKey === step.key ? 'bg-slate-50/50' : ''">
        <button
          type="button"
          class="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-3 px-5 py-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-atlair-950"
          :aria-expanded="openKey === step.key"
          :aria-controls="`setup-step-${step.key}`"
          @click="toggle(step.key)"
        >
          <span
            aria-hidden="true"
            class="mt-px flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-medium transition-colors"
            :class="step.done ? 'bg-status-live text-white' : step.key === currentKey ? 'bg-atlair-950 text-canvas' : 'text-slate-400 ring-1 ring-slate-300'"
          >
            <Check v-if="step.done" class="size-3.5" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="min-w-0">
            <span class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span class="text-sm font-medium" :class="step.done ? 'text-slate-600' : 'text-slate-900'">
                {{ step.title }}<span class="sr-only">{{ step.done ? ' (done)' : step.key === currentKey ? ' (next)' : '' }}</span>
              </span>
              <span v-if="step.status" class="text-xs" :class="step.statusTone === 'error' ? 'text-red-600' : step.statusTone === 'waiting' ? 'text-amber-700' : 'text-slate-500'">{{ step.status }}</span>
            </span>
            <span v-if="!step.done || openKey === step.key" class="mt-1 block max-w-2xl text-sm leading-relaxed text-slate-500">{{ step.why }}</span>
          </span>
          <NavArrowDown aria-hidden="true" class="mt-1 size-4 text-slate-400 transition-transform motion-reduce:transition-none" :class="openKey === step.key ? 'rotate-180' : ''" />
        </button>

        <div v-if="openKey === step.key" :id="`setup-step-${step.key}`" class="px-5 pb-5 pl-[3.75rem]">
          <p v-if="step.lockedReason" class="m-0 flex items-center gap-2 text-sm text-slate-500"><Lock aria-hidden="true" class="size-4" />{{ step.lockedReason }}</p>
          <p v-else-if="needsManager(step.key) && !canManage" class="m-0 text-sm text-slate-500">An owner or admin can do this step.</p>
          <ProviderStep v-else-if="step.key === 'provider'" :organization-id="organizationId" :overview="overview" />
          <DomainStep v-else-if="step.key === 'domain'" :organization-id="organizationId" :overview="overview" />
          <ApiKeyStep v-else-if="step.key === 'api-key'" :organization-id="organizationId" :overview="overview" :created="createdKey" @created="createdKey = $event" />
          <FirstEmailStep
            v-else
            :sending-domain="sendingDomain"
            :recipient="recipient"
            :api-key="createdKey"
            :sending="sendingTest"
            :sent-to="testSentTo"
            :error="testError"
            @send="emit('sendTest', $event)"
          />
        </div>
      </li>
    </ol>
  </section>
</template>
