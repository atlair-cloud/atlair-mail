import type { RouteRecordRaw } from 'vue-router'
import { queryClient } from '../../app/query-client'
import { listOrganizations, organizationsQueryKey } from '../../features/organizations'
import { resolveHome } from '../guards/session'

export const organizationRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: { render: () => null },
    beforeEnter: resolveHome,
    meta: { requiresAuth: true },
  },
  {
    path: '/organizations',
    component: () => import('../../layouts/ShellLayout.vue'),
    meta: { requiresAuth: true, shell: true },
    children: [
      {
        path: '',
        name: 'organizations',
        component: () => import('../../features/organizations/pages/OrganizationsPage.vue'),
        beforeEnter: async () => {
          await queryClient.ensureQueryData({ queryKey: organizationsQueryKey, queryFn: listOrganizations })
        },
        meta: { title: 'Organizations', depth: 1 },
      },
      {
        path: '/onboarding',
        name: 'onboarding',
        component: () => import('../../features/organizations/pages/CreateOrganizationPage.vue'),
        meta: { title: 'Create your organization', depth: 1 },
      },
      {
        path: 'new',
        name: 'organization-new',
        component: () => import('../../features/organizations/pages/CreateOrganizationPage.vue'),
        meta: { title: 'New organization', depth: 2 },
      },
      {
        path: ':organizationId',
        component: () => import('../../layouts/OrganizationLayout.vue'),
        children: [
          {
            path: '',
            name: 'organization',
            component: () => import('../../features/overview/pages/OverviewPage.vue'),
            meta: { title: 'Overview', depth: 2 },
          },
          {
            path: ':pathMatch(.*)*',
            name: 'organization-not-found',
            component: () => import('../../pages/NotFoundPage.vue'),
            meta: { title: 'Not found', depth: 3 },
          },
        ],
      },
    ],
  },
]
