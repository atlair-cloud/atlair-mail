import type { Fact } from '../../components/shared/FactsRow.vue'
import type { Authorship } from '../api/actors'
import { formatRelativeTime } from './relative-time'

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function authorshipFacts(item: Authorship, created = 'Created'): Fact[] {
  return [
    { label: created, value: absolute.format(new Date(item.createdAt)), title: new Date(item.createdAt).toLocaleString(), by: item.createdBy },
    { label: 'Updated', value: formatRelativeTime(item.updatedAt), title: new Date(item.updatedAt).toLocaleString(), by: item.updatedBy },
  ]
}
