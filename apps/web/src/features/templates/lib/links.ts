const variable = /\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}/g
const singleVariable = /^\{\{\s*[A-Za-z0-9_]{1,50}\s*\}\}$/
const webOrMail = /^(https?:\/\/|mailto:)\S+$/

export const isSafeLink = (value: string) => singleVariable.test(value) || webOrMail.test(value.replace(variable, 'x'))

export function isSafeImage(value: string) {
  return singleVariable.test(value) || /^https?:\/\/\S+$/.test(value.replace(variable, 'x'))
}

export function normalizeLink(value: string) {
  const trimmed = value.trim()
  if (isSafeLink(trimmed)) return trimmed
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed)) return `https://${trimmed}`
  return null
}

export const linkProblem = 'Use a web address, an email, or a {{variable}}'
