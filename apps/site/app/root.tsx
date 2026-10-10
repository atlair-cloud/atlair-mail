import { MotionConfig } from 'motion/react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import type { Route } from './+types/root'
import { themeScript } from './lib/theme'
import './app.css'

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
  { rel: 'icon', href: '/brand/atlair-mark.png', type: 'image/png' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#faf8f2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#101214" media="(prefers-color-scheme: dark)" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body className="bg-frame font-sans text-ink">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Outlet />
    </MotionConfig>
  )
}
