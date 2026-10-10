import type { Config } from '@react-router/dev/config'

import { alternatives } from './app/seo/alternatives'
import { useCases } from './app/seo/use-cases'

export default {
  ssr: false,
  prerender: [
    '/',
    '/alternatives',
    ...alternatives.map((a) => `/alternatives/${a.slug}`),
    '/use-cases',
    ...useCases.map((u) => `/use-cases/${u.slug}`),
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
  ],
} satisfies Config
