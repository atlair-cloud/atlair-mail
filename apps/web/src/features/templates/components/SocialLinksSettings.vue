<script setup lang="ts">
import { Trash } from '@iconoir/vue'
import type { Editor } from '@tiptap/core'
import { computed, ref, watch } from 'vue'
import { setNodeAttrs, type LocatedNode } from '../editor/useTemplateEditor'
import { linkProblem, normalizeLink } from '../lib/links'
import { SOCIAL_NETWORKS, socialNetworkList, type SocialLink, type SocialNetwork } from '../lib/social'
import PanelField from './PanelField.vue'

const props = defineProps<{ editor: Editor; target: LocatedNode; readonly: boolean; inputClass: string }>()

const links = computed(() => (props.target.node.attrs.links ?? []) as SocialLink[])
const unused = computed(() => socialNetworkList.filter((network) => !links.value.some((link) => link.network === network)))

const drafts = ref<string[]>([])
const errors = ref<(string | null)[]>([])

watch(
  links,
  (current) => {
    drafts.value = current.map((link) => (link.network === 'email' ? link.href.replace(/^mailto:/, '') : link.href))
    errors.value = current.map(() => null)
  },
  { immediate: true },
)

const save = (next: SocialLink[]) => {
  if (!props.readonly) setNodeAttrs(props.editor, props.target, { links: next })
}

function commit(index: number) {
  const value = drafts.value[index]?.trim() ?? ''
  const href = value ? normalizeLink(value) : ''
  if (href === null) {
    errors.value[index] = linkProblem
    return
  }
  errors.value[index] = null
  if (href !== links.value[index]?.href) save(links.value.map((link, at) => (at === index ? { ...link, href } : link)))
}

const adding = ref<SocialNetwork | ''>('')

function add() {
  const network = adding.value
  adding.value = ''
  if (!network) return
  save([...links.value, { network, href: '' }])
}

function remove(index: number) {
  save(links.value.filter((_, at) => at !== index))
}
</script>

<template>
  <div class="grid gap-3">
    <PanelField v-for="(link, index) in links" :key="link.network" :label="SOCIAL_NETWORKS[link.network].name" :for="`social-${link.network}`" :error="errors[index]">
      <template #aside>
        <button v-if="!readonly" type="button" class="flex size-5 items-center justify-center rounded-sm text-slate-400 hover:bg-red-50 hover:text-red-600" :aria-label="`Remove ${SOCIAL_NETWORKS[link.network].name}`" @click="remove(index)">
          <Trash class="size-3.5" />
        </button>
      </template>
      <div class="flex items-center gap-2">
        <component :is="SOCIAL_NETWORKS[link.network].icon" aria-hidden="true" class="size-4 shrink-0 text-slate-500" />
        <input
          :id="`social-${link.network}`"
          v-model="drafts[index]"
          :class="[inputClass, 'font-mono text-xs']"
          :placeholder="SOCIAL_NETWORKS[link.network].placeholder"
          spellcheck="false"
          :disabled="readonly"
          :aria-invalid="Boolean(errors[index])"
          @blur="commit(index)"
          @keydown.enter.prevent="commit(index)"
        />
      </div>
    </PanelField>

    <PanelField v-if="!readonly && unused.length" :label="links.length ? 'Add another' : 'Add a link'" for="social-add">
      <select id="social-add" v-model="adding" :class="inputClass" @change="add">
        <option value="" disabled>Choose a network…</option>
        <option v-for="network in unused" :key="network" :value="network">{{ SOCIAL_NETWORKS[network].name }}</option>
      </select>
    </PanelField>
    <p class="m-0 text-xs leading-relaxed text-slate-500">Icons turn light on dark backgrounds. They load from this server, so it needs a public address for them to show in inboxes.</p>
  </div>
</template>
