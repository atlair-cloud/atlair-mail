<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NotFound from '../components/shared/NotFound.vue'

const route = useRoute()
const insideOrganization = computed(() => typeof route.params.organizationId === 'string')
</script>

<template>
  <NotFound v-if="insideOrganization" :to="{ name: 'organization', params: { organizationId: route.params.organizationId } }" to-label="Go to overview" />
  <main v-else class="flex min-h-svh items-center justify-center bg-canvas">
    <NotFound :to="{ name: 'home' }" to-label="Go to your organizations" />
  </main>
</template>
