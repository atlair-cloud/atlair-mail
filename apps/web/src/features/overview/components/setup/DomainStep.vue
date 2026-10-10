<script setup lang="ts">
import { computed } from 'vue'
import { AddDomainForm, DomainVerification } from '../../../domains'
import type { Overview } from '../../api/get-overview'
import { primaryDomain } from '../../lib/setup'

const props = defineProps<{ organizationId: string; overview: Overview }>()

const existing = computed(() => primaryDomain(props.overview))
</script>

<template>
  <DomainVerification v-if="existing" :organization-id="organizationId" :domain-id="existing.id" :can-manage="true" />
  <AddDomainForm v-else :organization-id="organizationId" />
</template>
