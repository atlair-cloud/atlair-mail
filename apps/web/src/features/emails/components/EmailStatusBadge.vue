<script setup lang="ts">
import type { EmailStatus } from '../api/types'
import { EMAIL_STATUS } from '../lib/email-status'

withDefaults(defineProps<{ status: EmailStatus; compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="inline-flex items-center gap-2 text-xs font-medium" :class="EMAIL_STATUS[status].text">
    <span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="EMAIL_STATUS[status].dot" /><span :class="compact && 'max-sm:sr-only'">{{ EMAIL_STATUS[status].label }}</span>
  </span>
</template>
