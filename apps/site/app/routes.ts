import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('alternatives', 'routes/alternatives.tsx'),
  route('alternatives/:slug', 'routes/alternative.tsx'),
  route('use-cases', 'routes/use-cases.tsx'),
  route('use-cases/:slug', 'routes/use-case.tsx'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route('llms.txt', 'routes/llms.ts'),
] satisfies RouteConfig
