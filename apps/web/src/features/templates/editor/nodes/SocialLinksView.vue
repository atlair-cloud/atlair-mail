<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'
import { SOCIAL_NETWORKS, type SocialLink } from '../../lib/social'
import { useTemplateEditorContext } from '../context'

const props = defineProps(nodeViewProps)
const { readonly } = useTemplateEditorContext()

const links = computed(() => (props.node.attrs.links ?? []) as SocialLink[])
const justify = computed(() => ({ left: 'flex-start', center: 'center', right: 'flex-end' })[(props.node.attrs.textAlign ?? 'left') as 'left' | 'center' | 'right'])
</script>

<template>
  <NodeViewWrapper class="tpl-block tpl-social" :class="{ 'is-selected': selected }" :style="{ justifyContent: justify }" data-type="social-links">
    <span v-for="(link, index) in links" :key="`${link.network}-${index}`" class="tpl-social-icon" :title="SOCIAL_NETWORKS[link.network].name" contenteditable="false">
      <component :is="SOCIAL_NETWORKS[link.network].icon" aria-hidden="true" width="24" height="24" stroke-width="1.6" />
      <span class="sr-only">{{ SOCIAL_NETWORKS[link.network].name }}</span>
    </span>
    <span v-if="links.length === 0" class="tpl-social-empty" contenteditable="false">{{ readonly ? 'No social links' : 'Add social links in the sidebar' }}</span>
  </NodeViewWrapper>
</template>
