<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { turnOnDeliveryEvents } from '../api/provider'

const props = defineProps<{ organizationId: string }>()

const queryClient = useQueryClient()
const events = useMutation({
  mutationFn: () => turnOnDeliveryEvents(props.organizationId),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations', props.organizationId] }),
})
</script>

<template>
  <div class="rounded-md bg-white px-4 py-3 ring-1 ring-slate-200">
    <p class="m-0 text-sm font-medium text-slate-900">Turn on delivery tracking</p>
    <p class="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
      See which emails were delivered, bounced or marked as spam, and stop sending to addresses that bounce. Atlair Mail creates an SNS topic and an SQS queue in your AWS account and reads events from it; no public address needed.
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <UButton type="button" size="md" :loading="events.isPending.value" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas shadow-sm hover:bg-atlair-900" @click="events.mutate()">Turn on tracking</UButton>
      <p v-if="events.error.value" role="alert" class="m-0 text-sm text-red-600">{{ events.error.value.message }}</p>
    </div>
  </div>
</template>
