import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useOrganizationStore = defineStore('organization', () => {
  const lastOrganizationId = useStorage<string | null>('atlair-mail:last-organization-id', null)

  return { lastOrganizationId }
})
