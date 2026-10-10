/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_AUTH_SOCIAL_PROVIDERS?: string
  readonly VITE_BUILD_SHA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
