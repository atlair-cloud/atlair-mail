<script setup lang="ts">
import { Check, Copy, Refresh } from '@iconoir/vue'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { failureDetails, type FailureKind } from '../../app/failures'
import { productName } from '../../lib/brand'
import StatusScreen from './StatusScreen.vue'

const props = defineProps<{ error: unknown; kind: FailureKind }>()

const route = useRoute()
const { copy, copied, isSupported } = useClipboard({ copiedDuring: 1500 })

const text = computed(() =>
  props.kind === 'stale'
    ? { title: `${productName} has been updated`, body: 'A newer version of the panel is out, and this tab is still on the old one. Reload to get the latest version.' }
    : { title: 'Something went wrong on this page', body: 'Sending isn’t affected; only the panel ran into a problem. Reload to try again.' },
)
const message = computed(() => (props.error instanceof Error ? props.error.message : String(props.error)))

function reload() {
  window.location.reload()
}
</script>

<template>
  <StatusScreen :mood="kind === 'stale' ? 'calm' : 'concerned'" :title="text.title" :body="text.body" alert>
    <button
      type="button"
      class="h-9 rounded-sm px-3.5 inline-flex items-center gap-1.5 bg-atlair-950 text-sm font-medium text-white shadow-sm hover:bg-atlair-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950"
      @click="reload"
    >
      <Refresh aria-hidden="true" class="size-4" />Reload
    </button>
    <RouterLink
      :to="{ name: 'home' }"
      class="inline-flex h-9 items-center rounded-sm px-3 text-sm font-medium text-slate-700 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950"
    >Go to your organizations</RouterLink>
    <template v-if="kind === 'crash'" #detail>
      <div class="flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <p class="m-0 min-w-0 truncate font-mono" :title="message">{{ message }}</p>
        <button
          v-if="isSupported"
          type="button"
          class="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 font-medium text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-atlair-950"
          @click="copy(failureDetails(error, route.fullPath))"
        >
          <Check v-if="copied" aria-hidden="true" class="size-3.5 text-emerald-600" />
          <Copy v-else aria-hidden="true" class="size-3.5" />
          {{ copied ? 'Copied' : 'Copy details' }}
        </button>
      </div>
    </template>
  </StatusScreen>
</template>
