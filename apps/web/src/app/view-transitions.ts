import { nextTick } from 'vue'
import { START_LOCATION, type Router } from 'vue-router'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function waitForNavigation(router: Router) {
  return new Promise<void>((resolve) => {
    const stop = router.afterEach(() => {
      stop()
      resolve()
    })
  })
}

function focusPageHeading() {
  if (document.activeElement && document.activeElement !== document.body) return
  document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
}

export function installViewTransitions(router: Router) {
  router.beforeResolve((to, from) => {
    if (from === START_LOCATION || to.name === from.name) return

    if (!document.startViewTransition || reducedMotion.matches || (to.meta.shell && from.meta.shell)) {
      waitForNavigation(router).then(() => nextTick(focusPageHeading))
      return
    }

    document.documentElement.dataset.navDirection = (to.meta.depth ?? 0) >= (from.meta.depth ?? 0) ? 'forward' : 'back'

    return new Promise<void>((resolve) => {
      const transition = document.startViewTransition(async () => {
        const navigated = waitForNavigation(router)
        resolve()
        await navigated
        await nextTick()
      })
      transition.finished.finally(focusPageHeading)
    })
  })
}
