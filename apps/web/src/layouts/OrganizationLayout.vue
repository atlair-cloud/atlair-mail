<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import ErrorBoundary from '../components/shared/ErrorBoundary.vue'
import NotFound from '../components/shared/NotFound.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import { useCurrentOrganization, useOrganizationStore } from '../features/organizations'

const route = useRoute()
const organizationStore = useOrganizationStore()
const { organization, isPending } = useCurrentOrganization()

watchEffect(() => {
  if (organization.value) organizationStore.lastOrganizationId = organization.value.id
})
</script>

<template>
  <div class="relative px-4 pb-24 pt-10 sm:px-8 sm:pt-14" :class="{ 'lg:pb-8': route.meta.fill }">
    <div class="mx-auto w-full" :class="route.meta.wide ? 'max-w-[96rem]' : 'max-w-6xl'">
      <PageSkeleton v-if="isPending" label="Loading the organization" />
      <NotFound
        v-else-if="!organization"
        title="We couldn’t find that organization"
        body="It may have been deactivated, or you’re not a member of it."
        :to="{ name: 'organizations' }"
        to-label="Go to your organizations"
      />
      <ErrorBoundary v-else>
        <RouterView v-slot="{ Component }">
          <Transition name="page">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </ErrorBoundary>
    </div>
  </div>
</template>
