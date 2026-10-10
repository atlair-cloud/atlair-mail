<script setup lang="ts">
import { logoUrl, productName } from '../../lib/brand'
import UserMenu from '../organization/UserMenu.vue'
import ThemeToggle from './ThemeToggle.vue'
</script>

<template>
  <header class="frame-chrome relative z-10 shrink-0 [view-transition-name:app-topbar]">
    <div class="px-7 sm:px-12">
      <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-2.5">
        <RouterLink
          :to="{ name: 'organizations' }"
          class="flex shrink-0 items-center gap-2 rounded-sm text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <img class="size-7 object-contain [view-transition-name:brand-logo]" :src="logoUrl" alt="" width="28" height="28" />
          {{ productName }}
        </RouterLink>
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </div>
  </header>
</template>
