<script setup lang="ts">
import { Check, Computer, HalfMoon, SunLight } from '@iconoir/vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed } from 'vue'
import { panelTheme, setThemePreference, themePreference, type ThemePreference } from '../../app/panel-theme'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof SunLight }[] = [
  { value: 'system', label: 'System', icon: Computer },
  { value: 'light', label: 'Light', icon: SunLight },
  { value: 'dark', label: 'Dark', icon: HalfMoon },
]

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'Theme' }],
  OPTIONS.map((option) => ({
    label: option.label,
    icon: option.icon,
    current: themePreference.value === option.value,
    onSelect: () => setThemePreference(option.value),
  })),
])

const currentLabel = computed(() => OPTIONS.find((option) => option.value === themePreference.value)?.label ?? 'System')
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end', sideOffset: 8 }" :ui="{ content: 'w-44 rounded-sm', item: 'rounded-sm text-sm', label: 'text-xs font-normal text-slate-500' }">
    <UTooltip arrow :content="{ side: 'bottom' }" :text="`Theme: ${currentLabel}`">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[state=open]:bg-white/15 data-[state=open]:text-white motion-reduce:transition-none"
        :aria-label="`Theme: ${currentLabel}. Change theme`"
      >
        <HalfMoon v-if="panelTheme === 'dark'" aria-hidden="true" class="size-[18px]" />
        <SunLight v-else aria-hidden="true" class="size-[18px]" />
      </button>
    </UTooltip>
    <template #item-trailing="{ item }">
      <Check v-if="item.current" aria-label="Selected" class="size-4 text-atlair-950" />
    </template>
  </UDropdownMenu>
</template>
