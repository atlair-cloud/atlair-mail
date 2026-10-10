import { defineComponent, h, markRaw } from 'vue'

export const BracesIcon = markRaw(defineComponent({
  name: 'BracesIcon',
  setup(_, { attrs }) {
    return () =>
      h('svg', { ...attrs, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('path', { d: 'M8 4H7a2 2 0 0 0-2 2v3.5a2.5 2.5 0 0 1-2 2.45 2.5 2.5 0 0 1 2 2.45V18a2 2 0 0 0 2 2h1' }),
        h('path', { d: 'M16 4h1a2 2 0 0 1 2 2v3.5a2.5 2.5 0 0 0 2 2.45 2.5 2.5 0 0 0-2 2.45V18a2 2 0 0 1-2 2h-1' }),
      ])
  },
}))
