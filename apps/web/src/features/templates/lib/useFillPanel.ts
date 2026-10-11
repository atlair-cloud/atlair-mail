import { useMediaQuery, useResizeObserver, useWindowSize } from '@vueuse/core'
import { computed, onMounted, shallowRef, watch, type Ref } from 'vue'

export function useFillPanel(target: Ref<HTMLElement | null>, watched: Ref<HTMLElement | null>, minHeight = 520) {
  const large = useMediaQuery('(min-width: 1024px)')
  const { height: viewportHeight } = useWindowSize()
  const height = shallowRef<number | null>(null)

  function fit() {
    const element = target.value
    const panel = element?.closest<HTMLElement>('.shell-panel')
    if (!element || !panel || !large.value) {
      height.value = null
      return
    }
    const top = element.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop
    let below = 0
    for (let node: HTMLElement | null = element.parentElement; node && node !== panel.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node)
      below += Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth)
    }
    height.value = Math.max(minHeight, Math.floor(panel.clientHeight - top - below))
  }

  onMounted(fit)
  watch([large, viewportHeight], fit, { flush: 'post' })
  useResizeObserver(watched, fit)

  return computed(() => (height.value === null ? undefined : { height: `${height.value}px` }))
}
