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
            meta: { title: 'Overview', depth: 2, section: 'overview' },
          },
          {
            path: 'emails',
            name: 'emails',
            component: () => import('../../features/emails/pages/EmailsPage.vue'),
            meta: { title: 'Emails', depth: 3, section: 'emails' },
          },
          {
            path: 'emails/:emailId',
            name: 'email',
            component: () => import('../../features/emails/pages/EmailPage.vue'),
            meta: { title: 'Email', depth: 4, section: 'emails' },
          },
          {
            path: 'domains',
            name: 'domains',
            component: () => import('../../features/domains/pages/DomainsPage.vue'),
            meta: { title: 'Domains', depth: 3, section: 'domains' },
          },
          {
            path: 'domains/:domainId',
            name: 'domain',
            component: () => import('../../features/domains/pages/DomainPage.vue'),
            meta: { title: 'Domain', depth: 4, section: 'domains' },
          },
          {
            path: 'api-keys',
            name: 'api-keys',
            component: () => import('../../features/api-keys/pages/ApiKeysPage.vue'),
            meta: { title: 'API keys', depth: 3, section: 'api-keys' },
          },
          {
            path: 'webhooks',
            name: 'webhooks',
            component: () => import('../../features/webhooks/pages/WebhooksPage.vue'),
            meta: { title: 'Webhooks', depth: 3, section: 'webhooks' },
          },
          {
            path: 'webhooks/:webhookId',
            name: 'webhook',
            component: () => import('../../features/webhooks/pages/WebhookPage.vue'),
            meta: { title: 'Webhook', depth: 4, section: 'webhooks' },
          },
          {
            path: 'suppressions',
            name: 'suppressions',
            component: () => import('../../features/suppressions/pages/SuppressionsPage.vue'),
            meta: { title: 'Suppressions', depth: 3, section: 'suppressions' },
          },
          {
            path: 'playground',
            name: 'playground',
            component: () => import('../../features/developers/pages/PlaygroundPage.vue'),
            meta: { title: 'Playground', depth: 3, section: 'playground' },
          },
          {
            path: 'settings',
            component: () => import('../../features/settings/pages/SettingsLayout.vue'),
            meta: { depth: 3, section: 'settings' },
            children: [
              {
                path: '',
                name: 'organization-settings',
                component: () => import('../../features/settings/pages/SettingsGeneralPage.vue'),
                meta: { title: 'Settings' },
              },
              {
                path: 'provider',
                name: 'organization-settings-provider',
                component: () => import('../../features/settings/pages/SettingsProviderPage.vue'),
                meta: { title: 'Provider · Settings' },
              },
              {
                path: 'members',
                name: 'organization-settings-members',
                component: () => import('../../features/settings/pages/SettingsMembersPage.vue'),
                meta: { title: 'Members · Settings' },
              },
              {
                path: 'audit-log',
                name: 'organization-settings-activity',
                component: () => import('../../features/settings/pages/SettingsActivityPage.vue'),
                meta: { title: 'Audit log · Settings' },
              },
            ],
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
