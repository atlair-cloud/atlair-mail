<script setup lang="ts">
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isStaleBuildError } from '../../app/failures'
import CrashScreen from './CrashScreen.vue'

const route = useRoute()
const captured = shallowRef<unknown>(null)

onErrorCaptured((error) => {
  console.error(error)
  captured.value = error
  return false
})

watch(
  () => route.path,
  () => {
    captured.value = null
  },
)
</script>

<template>
  <CrashScreen v-if="captured" :error="captured" :kind="isStaleBuildError(captured) ? 'stale' : 'crash'" />
  <slot v-else />
</template>
