import { API_URL } from '../../../lib/api/client'

export type SnippetLanguage = 'curl' | 'node' | 'python'

export const SNIPPET_LANGUAGES: { value: SnippetLanguage; label: string }[] = [
  { value: 'curl', label: 'cURL' },
  { value: 'node', label: 'Node.js' },
  { value: 'python', label: 'Python' },
]

export type ApiCall = { method: string; path: string; body?: unknown; query?: Record<string, string> }

const keyVariable = 'ATLAIR_MAIL_API_KEY'

function url(call: ApiCall) {
  const query = call.query && Object.keys(call.query).length ? `?${new URLSearchParams(call.query)}` : ''
  return `${API_URL}/service/web${call.path}${query}`
}

const indent = (text: string, spaces: number) => text.split('\n').join(`\n${' '.repeat(spaces)}`)

function curl(call: ApiCall) {
  const lines = [`curl -X ${call.method} "${url(call)}"`, `  -H "Authorization: Bearer $${keyVariable}"`]
  if (call.body !== undefined) {
    lines.push('  -H "Content-Type: application/json"')
    lines.push(`  -d '${JSON.stringify(call.body, null, 2).replaceAll("'", "'\\''")}'`)
  }
  return lines.join(' \\\n')
}

function node(call: ApiCall) {
  const options = [`method: '${call.method}'`, `headers: {\n    Authorization: \`Bearer \${process.env.${keyVariable}}\`,${call.body !== undefined ? "\n    'Content-Type': 'application/json'," : ''}\n  }`]
  if (call.body !== undefined) options.push(`body: JSON.stringify(${indent(JSON.stringify(call.body, null, 2), 2)})`)
  return [`const response = await fetch('${url(call)}', {`, `  ${options.join(',\n  ')},`, '})', '', 'console.log(response.status, await response.json())'].join('\n')
}

function python(call: ApiCall) {
  const args = [`"${url(call)}"`, `headers={"Authorization": f"Bearer {os.environ['${keyVariable}']}"}`]
  if (call.body !== undefined) args.push(`json=${indent(JSON.stringify(call.body, null, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None'), 0)}`)
  return ['import os', 'import requests', '', `response = requests.${call.method.toLowerCase()}(`, `    ${args.map((arg) => indent(arg, 4)).join(',\n    ')},`, ')', 'print(response.status_code, response.json())'].join('\n')
}

export function snippet(language: SnippetLanguage, call: ApiCall) {
  switch (language) {
    case 'curl':
      return curl(call)
    case 'node':
      return node(call)
    case 'python':
      return python(call)
  }
}
