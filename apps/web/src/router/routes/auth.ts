import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/auth/login',
    name: 'auth-login',
    component: () => import('../../features/auth/pages/LoginPage.vue'),
    meta: { title: 'Sign in', guestOnly: true, depth: 0 },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../../features/auth/pages/AuthCallbackPage.vue'),
    meta: { title: 'Signing in', depth: 0 },
  },
]
