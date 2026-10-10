<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import CopyButton from '../../../components/shared/CopyButton.vue'
import { SNIPPET_LANGUAGES, snippet, type ApiCall, type SnippetLanguage } from '../lib/snippets'

const props = defineProps<{ call: ApiCall; label?: string }>()

const language = useStorage<SnippetLanguage>('atlair-mail:snippet-language', 'curl')
const code = computed(() => snippet(language.value, props.call))
</script>

<template>
  <div class="overflow-hidden rounded-md bg-[#14171a] ring-1 ring-black/20">
    <div class="flex items-center justify-between gap-3 border-b border-[#262b30] px-2 py-1.5">
      <div role="tablist" :aria-label="label ?? 'Language'" class="flex gap-0.5">
        <button
          v-for="option in SNIPPET_LANGUAGES"
          :key="option.value"
          type="button"
          role="tab"
          :aria-selected="language === option.value"
          class="rounded-sm px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#d6dbe0] motion-reduce:transition-none"
          :class="language === option.value ? 'bg-[#262b30] text-[#f1f3f5]' : 'text-[#8b939c] hover:text-[#f1f3f5]'"
          @click="language = option.value"
        >{{ option.label }}</button>
      </div>
      <CopyButton :value="code" tone="dark" />
    </div>
    <pre class="m-0 overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-[#d6dbe0]"><code>{{ code }}</code></pre>
  </div>
</template>
