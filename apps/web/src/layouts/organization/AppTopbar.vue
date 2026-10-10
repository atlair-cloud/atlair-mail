<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useCurrentOrganization } from '../../features/organizations'
import { logoUrl } from '../../lib/brand'
import ThemeToggle from '../shell/ThemeToggle.vue'
import CommandMenu from './CommandMenu.vue'
import OrganizationSwitcher from './OrganizationSwitcher.vue'
import UserMenu from './UserMenu.vue'

const route = useRoute()
const { organizationId } = useCurrentOrganization()
</script>

<template>
  <header class="frame-chrome relative z-10 shrink-0 [view-transition-name:app-topbar]">
    <div class="px-7 sm:px-12">
      <div class="relative mx-auto flex h-14 w-full items-center gap-2" :class="route.meta.wide ? 'max-w-[96rem]' : 'max-w-6xl'">
        <UTooltip arrow :content="{ side: 'bottom' }" text="Overview">
          <RouterLink
            :to="{ name: 'organization', params: { organizationId } }"
            class="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Overview"
          >
            <img class="size-7 object-contain [view-transition-name:brand-logo]" :src="logoUrl" alt="" width="28" height="28" />
          </RouterLink>
        </UTooltip>

        <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1 text-sm lg:max-w-[calc(50%-12rem)]">
          <span aria-hidden="true" class="text-white/45">/</span>
          <OrganizationSwitcher />
        </nav>

        <div class="ml-auto flex shrink-0 items-center gap-2">
          <CommandMenu />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </div>
  </header>
</template>
