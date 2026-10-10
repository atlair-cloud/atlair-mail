<script setup lang="ts">
import { BellNotification, Book, CloudSync, Computer, Globe, Group, HalfMoon, Home, Journal, Key, Mail, Page, Prohibition, Search, Send, Settings, SunLight } from '@iconoir/vue'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { onKeyStroke } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { setThemePreference } from '../../app/panel-theme'
import { useCurrentOrganization } from '../../features/organizations'
import { API_DOCS_URL } from '../../lib/links'

const router = useRouter()
const { organizationId, organization, organizations } = useCurrentOrganization()
const open = ref(false)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

onKeyStroke('k', (event) => {
  if (!(event.metaKey || event.ctrlKey)) return
  event.preventDefault()
  open.value = !open.value
})

function go(to: RouteLocationRaw) {
  open.value = false
  router.push(to)
}

function run(action: () => void) {
  open.value = false
  action()
}

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const org = { organizationId: organizationId.value }

  return [
    {
      id: 'navigate',
      label: 'Go to',
      items: [
        { id: 'overview', label: 'Overview', kind: 'icon', glyph: Home, onSelect: () => go({ name: 'organization', params: org }) },
        { id: 'emails', label: 'Emails', kind: 'icon', glyph: Mail, onSelect: () => go({ name: 'emails', params: org }) },
        { id: 'emails-failed', label: 'Failed emails', kind: 'icon', glyph: Mail, onSelect: () => go({ name: 'emails', params: org, query: { status: 'failed' } }) },
        { id: 'emails-bounced', label: 'Bounced emails', kind: 'icon', glyph: Mail, onSelect: () => go({ name: 'emails', params: org, query: { status: 'bounced' } }) },
        { id: 'templates', label: 'Templates', kind: 'icon', glyph: Page, onSelect: () => go({ name: 'templates', params: org }) },
        { id: 'template-new', label: 'New template', kind: 'icon', glyph: Page, onSelect: () => go({ name: 'template', params: { ...org, templateId: 'new' } }) },
        { id: 'domains', label: 'Domains', kind: 'icon', glyph: Globe, onSelect: () => go({ name: 'domains', params: org }) },
        { id: 'api-keys', label: 'API keys', kind: 'icon', glyph: Key, onSelect: () => go({ name: 'api-keys', params: org }) },
        { id: 'webhooks', label: 'Webhooks', kind: 'icon', glyph: BellNotification, onSelect: () => go({ name: 'webhooks', params: org }) },
        { id: 'suppressions', label: 'Suppressions', kind: 'icon', glyph: Prohibition, onSelect: () => go({ name: 'suppressions', params: org }) },
        { id: 'playground', label: 'Playground: send a test email', kind: 'icon', glyph: Send, onSelect: () => go({ name: 'playground', params: org }) },
        { id: 'api-docs', label: 'API docs (opens the docs site)', kind: 'icon', glyph: Book, onSelect: () => run(() => window.open(API_DOCS_URL, '_blank', 'noopener')) },
        { id: 'settings', label: 'Settings', kind: 'icon', glyph: Settings, onSelect: () => go({ name: 'organization-settings', params: org }) },
        { id: 'provider', label: 'Provider (Amazon SES)', kind: 'icon', glyph: CloudSync, onSelect: () => go({ name: 'organization-settings-provider', params: org }) },
        { id: 'members', label: 'Members', kind: 'icon', glyph: Group, onSelect: () => go({ name: 'organization-settings-members', params: org }) },
        { id: 'audit-log', label: 'Audit log', kind: 'icon', glyph: Journal, onSelect: () => go({ name: 'organization-settings-activity', params: org }) },
      ],
    },
    {
      id: 'organizations',
      label: 'Switch organization',
      items: organizations.value
        .filter((item) => item.id !== organization.value?.id)
        .map((item) => ({ id: `org-${item.id}`, label: item.name, kind: 'organization', onSelect: () => go({ name: 'organization', params: { organizationId: item.id } }) })),
    },
    {
      id: 'theme',
      label: 'Theme',
      items: [
        { id: 'theme-system', label: 'Use system theme', kind: 'icon', glyph: Computer, onSelect: () => run(() => setThemePreference('system')) },
        { id: 'theme-light', label: 'Switch to light', kind: 'icon', glyph: SunLight, onSelect: () => run(() => setThemePreference('light')) },
        { id: 'theme-dark', label: 'Switch to dark', kind: 'icon', glyph: HalfMoon, onSelect: () => run(() => setThemePreference('dark')) },
      ],
    },
  ].filter((group) => group.items.length)
})
</script>

<template>
  <UTooltip arrow :content="{ side: 'bottom' }" text="Search and jump to" :kbds="['meta', 'k']">
    <button
      type="button"
      class="group flex h-8 items-center gap-2 rounded-sm text-sm transition-[color,box-shadow,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-atlair-950 motion-reduce:transition-none max-lg:w-8 max-lg:justify-center max-lg:text-white/70 max-lg:hover:bg-white/10 max-lg:hover:text-white lg:absolute lg:left-1/2 lg:top-1/2 lg:h-9 lg:w-80 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-sm lg:bg-canvas lg:pl-3 lg:pr-1.5 lg:text-slate-500 lg:shadow-[0_0_0_1px_var(--color-slate-200),0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.25)] lg:hover:text-slate-800 lg:hover:shadow-[0_0_0_1px_var(--color-slate-300),0_1px_2px_rgb(0_0_0/0.06),0_10px_28px_-12px_rgb(0_0_0/0.3)]"
      aria-label="Search and jump to"
      aria-keyshortcuts="Meta+K Control+K"
      @click="open = true"
    >
      <Search aria-hidden="true" class="size-[18px] shrink-0 lg:size-4" />
      <span class="max-lg:hidden">Jump to a page or organization…</span>
      <kbd class="ml-auto flex h-6 items-center rounded-[3px] bg-slate-100 px-1.5 font-mono text-[11px] text-slate-500 ring-1 ring-inset ring-slate-200 group-hover:text-slate-700 max-lg:hidden">{{ isMac ? '⌘' : 'Ctrl ' }}K</kbd>
    </button>
  </UTooltip>

  <UModal v-model:open="open" title="Search and jump to" description="Pages, organizations and theme" :ui="{ content: 'max-w-xl overflow-hidden rounded-md ring-slate-200 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)]', overlay: 'bg-slate-950/30 backdrop-blur-[2px]' }">
    <template #content>
      <UCommandPalette
        :groups="groups"
        placeholder="Search pages and organizations…"
        :close="false"
        :fuse="{ fuseOptions: { keys: ['label', 'hint', 'meta'] } }"
        class="h-[26rem]"
        :ui="{
          input: '[&>input]:h-12 [&>input]:rounded-none [&>input]:text-[15px] [&>input]:shadow-none [&>input]:focus-visible:shadow-none',
          viewport: 'p-1.5',
          group: 'p-0 py-1',
          label: 'px-2.5 pb-1.5 pt-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500',
          item: 'items-center gap-3 rounded-sm px-2.5 py-2 text-sm before:rounded-sm data-highlighted:not-data-disabled:before:bg-slate-100',
          itemLabelBase: 'font-medium text-slate-900',
          itemWrapper: 'self-center items-start justify-center',
          itemLabel: 'leading-5',
          itemTrailing: 'self-center',
          footer: 'p-0',
        }"
      >
        <template #item-leading="{ item }">
          <span v-if="item.kind === 'organization'" aria-hidden="true" class="flex size-7 shrink-0 items-center justify-center rounded-sm bg-atlair-950 text-xs font-semibold text-canvas">{{ String(item.label).trim().charAt(0).toUpperCase() }}</span>
          <span v-else aria-hidden="true" class="flex size-7 shrink-0 items-center justify-center rounded-sm text-slate-500 ring-1 ring-slate-200">
            <component :is="item.glyph" class="size-4" />
          </span>
        </template>
        <template #item-label="{ item }">
          <span class="font-medium text-slate-900">{{ item.label }}</span>
          <span v-if="item.hint" class="ml-2 text-slate-500">in {{ item.hint }}</span>
        </template>
        <template #item-trailing="{ item }">
          <span v-if="item.meta" class="font-mono text-[11px] text-slate-500">{{ item.meta }}</span>
        </template>
        <template #empty="{ searchTerm }">
          <p class="m-0 py-10 text-center text-sm text-slate-500">Nothing matches “{{ searchTerm }}”.</p>
        </template>
        <template #footer>
          <div class="flex items-center gap-4 px-4 py-2.5 font-mono text-[11px] text-slate-500">
            <span class="flex items-center gap-1.5"><kbd class="rounded-[3px] bg-slate-100 px-1.5 py-0.5 ring-1 ring-inset ring-slate-200">↑↓</kbd>move</span>
            <span class="flex items-center gap-1.5"><kbd class="rounded-[3px] bg-slate-100 px-1.5 py-0.5 ring-1 ring-inset ring-slate-200">↵</kbd>open</span>
            <span class="ml-auto flex items-center gap-1.5"><kbd class="rounded-[3px] bg-slate-100 px-1.5 py-0.5 ring-1 ring-inset ring-slate-200">esc</kbd>close</span>
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
