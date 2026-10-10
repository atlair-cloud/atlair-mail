const number = new Intl.NumberFormat()

export function formatCount(value: number) {
  return number.format(value)
}

export function formatRate(value: number | null) {
  if (value === null) return '—'
  const percent = value * 100
  if (percent === 0) return '0%'
  if (percent < 1) return `${percent.toFixed(2)}%`
  if (percent >= 99.95 && percent < 100) return '99.9%'
  return `${percent.toFixed(1)}%`
}
