import type { RouteComponent, RouteRecordNormalized, RouteRecordRaw, Router } from 'vue-router'

type Lazy = () => Promise<RouteComponent>
type Connection = { saveData?: boolean; effectiveType?: string }

const loaded = new WeakSet<Lazy>()

function constrained() {
  const connection = (navigator as Navigator & { connection?: Connection }).connection
  return !!connection && (connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType ?? ''))
}

function load(component: unknown) {
  if (typeof component !== 'function' || 'render' in component || 'setup' in component) return
  const lazy = component as Lazy
  if (loaded.has(lazy)) return
  loaded.add(lazy)
  lazy().catch(() => loaded.delete(lazy))
}

function loadRecord(record: RouteRecordNormalized | RouteRecordRaw) {
  const components = 'components' in record && record.components ? record.components : 'component' in record ? { default: record.component } : {}
  Object.values(components).forEach(load)
}

function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 3000 })
  else setTimeout(task, 1200)
}

export function installRoutePrefetch(router: Router) {
  router.afterEach((to, _from, failure) => {
    if (failure || constrained()) return
    whenIdle(() => to.matched.forEach((record) => record.children.forEach(loadRecord)))
  })

  function prefetchLink(event: Event) {
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!anchor || anchor.target === '_blank' || anchor.origin !== location.origin) return
    router.resolve(anchor.pathname + anchor.search).matched.forEach(loadRecord)
  }

  document.addEventListener('pointerover', prefetchLink, { passive: true })
  document.addEventListener('focusin', prefetchLink, { passive: true })
  document.addEventListener('touchstart', prefetchLink, { passive: true })
}
