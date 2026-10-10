<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import AvatarFace from '../../components/shared/AvatarFace.vue'
import { getMe, meQueryKey, useSignOut } from '../../features/auth'

const { data: user } = useQuery({ queryKey: meQueryKey, queryFn: getMe })
const { signOut } = useSignOut()

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.email ?? '' }],
  [{ label: 'Sign out', onSelect: () => signOut() }],
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end', sideOffset: 8 }" :ui="{ content: 'w-60 rounded-sm', item: 'rounded-sm text-sm', label: 'truncate text-xs font-normal text-slate-500' }">
    <UTooltip arrow :content="{ side: 'bottom' }" text="Account">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-full transition-shadow hover:ring-4 hover:ring-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[state=open]:ring-4 data-[state=open]:ring-white/25 motion-reduce:transition-none"
        :aria-label="`Account menu for ${user?.name ?? 'you'}`"
      >
        <span aria-hidden="true" class="flex size-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 ring-1 ring-white/25"><AvatarFace :name="user?.name ?? ''" :image-url="user?.image" /></span>
      </button>
    </UTooltip>
  </UDropdownMenu>
</template>
