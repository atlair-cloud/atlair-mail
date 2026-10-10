import { createRouter, createWebHistory } from 'vue-router'
import { installViewTransitions } from '../app/view-transitions'
import { productName } from '../lib/brand'
import { authGuard } from './guards/session'
import { authRoutes } from './routes/auth'
import { organizationRoutes } from './routes/organizations'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    guestOnly?: boolean
    depth?: number
    wide?: boolean
    fill?: boolean
    shell?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...authRoutes,
    ...organizationRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
      meta: { title: 'Not found' },
    },
  ],
})

router.beforeEach(authGuard)
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${productName}` : productName
})
installViewTransitions(router)
