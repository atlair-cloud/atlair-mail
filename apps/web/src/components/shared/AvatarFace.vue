<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ name: string; imageUrl?: string | null }>()

const failed = ref(false)
watch(() => props.imageUrl, () => (failed.value = false))

const usable = computed(() => !!props.imageUrl && /^https:\/\//.test(props.imageUrl) && !failed.value)
const initials = computed(() => props.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '·')
</script>

<template>
  <img v-if="usable" :src="imageUrl!" alt="" referrerpolicy="no-referrer" loading="lazy" class="size-full rounded-full object-cover" @error="failed = true" />
  <template v-else>{{ initials }}</template>
</template>
