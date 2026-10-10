import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    ui({
      colorMode: false,
      ui: {
        colors: { primary: 'slate', neutral: 'slate' },
        input: { slots: { base: 'focus-visible:shadow-[0_0_0_3px_var(--color-slate-200)]' } },
        textarea: { slots: { base: 'focus-visible:shadow-[0_0_0_3px_var(--color-slate-200)]' } },
        modal: { slots: { overlay: 'z-40', content: 'z-50' } },
        tooltip: {
          slots: {
            content: 'z-[60] h-auto rounded-sm bg-atlair-950 px-2 py-1 text-xs font-medium text-canvas shadow-md ring-0',
            arrow: 'fill-atlair-950 stroke-0',
            kbds: 'ms-1 gap-0.5 before:hidden [&>kbd]:bg-canvas/15 [&>kbd]:text-canvas [&>kbd]:ring-0',
          },
        },
        slideover: { slots: { overlay: 'z-40', content: 'z-50' } },
        dropdownMenu: {
          slots: {
            content: 'z-50 bg-white',
            item: 'text-slate-700 data-highlighted:not-data-disabled:before:bg-slate-100 data-highlighted:not-data-disabled:text-slate-900 before:rounded-sm',
          },
          compoundVariants: [
            {
              color: 'error',
              active: false,
              class: { item: 'text-red-600 data-highlighted:not-data-disabled:text-red-700 data-highlighted:not-data-disabled:before:bg-red-50' },
            },
          ],
        },
        popover: { slots: { content: 'bg-white' } },
        selectMenu: {
          slots: {
            content: 'z-50 bg-white',
            item: 'text-slate-700 data-highlighted:not-data-disabled:before:bg-slate-100 data-highlighted:not-data-disabled:text-slate-900 data-[state=checked]:text-slate-900 before:rounded-sm',
            itemTrailingIcon: 'text-atlair-950',
          },
        },
      },
    }),
  ],
  define: {
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify((process.env.BUILD_SHA ?? 'local').slice(0, 7)),
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?(vue|@vue\/[^/]+|vue-router|pinia|@tanstack\/(?:query-core|vue-query)|better-auth|@better-auth|@better-fetch|nanostores|unhead|@unhead|hookable|ohash|defu|ufo)\//.test(id)) return 'framework'
        },
      },
    },
  },
})
