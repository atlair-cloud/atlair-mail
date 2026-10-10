import { computed, ref, watch, type WatchSource } from 'vue'

export function useCursorPages(resetOn: WatchSource) {
  const cursors = ref<(string | undefined)[]>([undefined])

  watch(resetOn, () => {
    cursors.value = [undefined]
  }, { deep: true })

  return {
    page: computed(() => cursors.value.length),
    cursor: computed(() => cursors.value.at(-1)),
    next(lastId: string | undefined) {
      if (lastId) cursors.value = [...cursors.value, lastId]
    },
    previous() {
      if (cursors.value.length > 1) cursors.value = cursors.value.slice(0, -1)
    },
    reset() {
      cursors.value = [undefined]
    },
  }
}
