<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarFace from '../../../components/shared/AvatarFace.vue'
import ConfirmModal from '../../../components/shared/ConfirmModal.vue'
import LoadErrorCard from '../../../components/shared/LoadErrorCard.vue'
import SettingsCard from '../../../components/shared/SettingsCard.vue'
import TextButton from '../../../components/shared/TextButton.vue'
import { formatRelativeTime } from '../../../lib/format/relative-time'
import { getMe, meQueryKey } from '../../auth'
import { useCurrentOrganization } from '../../organizations'
import { addMember, listMembers, listRoles, membersQueryKey, removeMember, rolesQueryKey, updateMemberRole, type Member, type RoleName } from '../api/members'
import { ROLES, roleLabel } from '../lib/roles'

const router = useRouter()
const toast = useToast()
const queryClient = useQueryClient()
const { organizationId, canManage } = useCurrentOrganization()
const { data: me } = useQuery({ queryKey: meQueryKey, queryFn: getMe })

const query = useQuery({
  queryKey: computed(() => membersQueryKey(organizationId.value)),
  queryFn: () => listMembers(organizationId.value),
})
const members = computed(() => [...(query.data.value ?? [])].sort((a, b) => ['owner', 'admin', 'member'].indexOf(a.role) - ['owner', 'admin', 'member'].indexOf(b.role)))

const roles = useQuery({
  queryKey: computed(() => rolesQueryKey(organizationId.value)),
  queryFn: () => listRoles(organizationId.value),
  staleTime: 5 * 60_000,
})
const roleItems = computed(() =>
  (roles.data.value?.map((item) => item.name) ?? ['admin', 'member'])
    .filter((name): name is Exclude<RoleName, 'owner'> => name !== 'owner')
    .map((name) => ({ label: roleLabel(name), value: name })),
)
const permissionCount = (name: RoleName) => roles.data.value?.find((item) => item.name === name)?.permissions.length

const refresh = () => queryClient.invalidateQueries({ queryKey: ['organizations', organizationId.value] })

const email = ref('')
const role = ref<Exclude<RoleName, 'owner'>>('member')
const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const add = useMutation({
  mutationFn: () => addMember(organizationId.value, { email: email.value.trim().toLowerCase(), role: role.value }),
  async onSuccess(member) {
    email.value = ''
    await refresh()
    toast.add({ title: `${member.name} added`, description: `They can open ${member.role === 'admin' ? 'and manage ' : ''}this organization now.`, color: 'neutral' })
  },
})

const changeRole = useMutation({
  mutationFn: (input: { member: Member; role: RoleName }) => updateMemberRole(organizationId.value, input.member.id, input.role),
  async onSuccess(member) {
    await refresh()
    toast.add({ title: `${member.name} is now ${roleLabel(member.role).toLowerCase()}`, color: 'neutral' })
  },
  onError: (error) => toast.add({ title: 'Couldn’t change the role', description: error.message, color: 'error' }),
})

const removing = ref<Member | null>(null)
const removeOpen = computed({
  get: () => removing.value !== null,
  set: (open) => {
    if (!open) removing.value = null
  },
})
const remove = useMutation({
  mutationFn: (member: Member) => removeMember(organizationId.value, member.id),
  async onSuccess(_result, member) {
    removing.value = null
    if (member.userId === me.value?.id) {
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      await router.replace({ name: 'organizations' })
      toast.add({ title: 'You left the organization', color: 'neutral' })
      return
    }
    await refresh()
    toast.add({ title: `${member.name} removed`, color: 'neutral' })
  },
})

function submit() {
  if (validEmail.value && !add.isPending.value) add.mutate()
}
</script>

<template>
  <div class="divide-y divide-slate-200">
    <SettingsCard v-if="canManage" title="Add a member" description="They need to have signed in to Atlair Mail once, with the same email.">
      <form id="add-member-form" class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]" novalidate @submit.prevent="submit">
        <div>
          <label for="member-email" class="block text-xs font-medium text-slate-700">Email</label>
          <UInput id="member-email" v-model="email" type="email" size="lg" autocomplete="off" placeholder="ada@yourcompany.com" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white text-sm' }" :disabled="add.isPending.value" @update:model-value="add.reset()" />
        </div>
        <div>
          <label for="member-role" class="block text-xs font-medium text-slate-700">Role</label>
          <USelect id="member-role" v-model="role" :items="roleItems" size="lg" class="mt-1.5 w-full" :ui="{ base: 'h-10 rounded-sm bg-white text-sm' }" :disabled="add.isPending.value" />
        </div>
      </form>
      <p class="m-0 mt-2 text-xs text-slate-500">
        {{ ROLES.find((item) => item.value === role)?.description }}<template v-if="permissionCount(role)"> {{ permissionCount(role) }} permissions.</template>
      </p>
      <p v-if="add.error.value" role="alert" class="m-0 mt-2 text-sm text-red-600">{{ add.error.value.message }}</p>
      <template #footer>
        <span />
        <UButton type="submit" form="add-member-form" size="md" :loading="add.isPending.value" :disabled="!validEmail" class="h-9 rounded-sm bg-atlair-950 px-3.5 text-sm font-medium text-canvas hover:bg-atlair-900 disabled:opacity-40">Add member</UButton>
      </template>
    </SettingsCard>

    <SettingsCard title="Members" description="Owners and admins manage everything except deactivating, which only the owner can do. Members see everything but the audit log, and can send.">
      <div v-if="query.isPending.value" class="skeleton-card h-32 rounded-sm" aria-busy="true" />
      <LoadErrorCard v-else-if="query.isError.value" :error="query.error.value" subject="members" @retry="query.refetch()" />
      <ul v-else class="-mx-5 -my-5 m-0 list-none divide-y divide-slate-100 p-0">
        <li v-for="member in members" :key="member.id" class="flex flex-wrap items-center gap-3 px-5 py-3">
          <span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700"><AvatarFace :name="member.name" :image-url="member.image" /></span>
          <div class="min-w-0 flex-1">
            <p class="m-0 truncate text-sm font-medium text-slate-900">
              {{ member.name }}<span v-if="member.userId === me?.id" class="ml-2 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">You</span>
            </p>
            <p class="m-0 truncate text-xs text-slate-500">{{ member.email }} · joined {{ formatRelativeTime(member.createdAt) }}</p>
          </div>
          <USelect
            v-if="canManage && member.role !== 'owner' && member.userId !== me?.id"
            :model-value="member.role"
            :items="roleItems"
            size="sm"
            class="w-28"
            :aria-label="`Role for ${member.name}`"
            :ui="{ base: 'h-8 rounded-sm bg-white text-sm' }"
            :disabled="changeRole.isPending.value"
            @update:model-value="(value) => value !== member.role && changeRole.mutate({ member, role: value as RoleName })"
          />
          <span v-else class="w-28 text-sm text-slate-600">{{ roleLabel(member.role) }}</span>
          <TextButton v-if="canManage && member.role !== 'owner'" tone="danger" @click="remove.reset(); removing = member">{{ member.userId === me?.id ? 'Leave' : 'Remove' }}</TextButton>
          <span v-else-if="canManage" class="w-[3.75rem]" />
        </li>
      </ul>
    </SettingsCard>

    <ConfirmModal
      v-model:open="removeOpen"
      :title="removing?.userId === me?.id ? 'Leave this organization?' : `Remove ${removing?.name}?`"
      :description="removing?.userId === me?.id ? 'You lose access right away. An owner or admin can add you back.' : 'They lose access right away. API keys they created keep working.'"
      :action="removing?.userId === me?.id ? 'Leave' : 'Remove'"
      :pending="remove.isPending.value"
      :error="remove.error.value?.message"
      @confirm="removing && remove.mutate(removing)"
    />
  </div>
</template>
