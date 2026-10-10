import ui from '@nuxt/ui/vue-plugin'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { installFailureHandling } from './failures'
import './panel-theme'
import { queryClient } from './query-client'
import { installRoutePrefetch } from './route-prefetch'
import { router } from '../router'

export function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())
  app.use(router)
  app.use(ui)
  app.use(VueQueryPlugin, { queryClient })
  installFailureHandling(app, router)
  installRoutePrefetch(router)

  return app
}
