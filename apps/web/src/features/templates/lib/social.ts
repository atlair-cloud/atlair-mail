import { Discord, Facebook, Github, Globe, Instagram, Mail, Mastodon, Threads, Tiktok, X, Youtube } from '@iconoir/vue'
import { defineComponent, h, markRaw, type Component } from 'vue'

export type SocialNetwork = 'x' | 'linkedin' | 'github' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'discord' | 'threads' | 'mastodon' | 'website' | 'email'

export type SocialLink = { network: SocialNetwork; href: string }

const Linkedin = defineComponent({
  name: 'LinkedinIcon',
  setup: (_, { attrs }) => () =>
    h('svg', { viewBox: '0 0 24 24', width: '1.5em', height: '1.5em', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }, [
      h('path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' }),
      h('rect', { width: 4, height: 12, x: 2, y: 9 }),
      h('circle', { cx: 4, cy: 4, r: 2 }),
    ]),
})

type NetworkInfo = { name: string; icon: Component; placeholder: string }

export const SOCIAL_NETWORKS: Record<SocialNetwork, NetworkInfo> = {
  x: { name: 'X', icon: markRaw(X), placeholder: 'https://x.com/yourname' },
  linkedin: { name: 'LinkedIn', icon: markRaw(Linkedin), placeholder: 'https://linkedin.com/company/yourname' },
  github: { name: 'GitHub', icon: markRaw(Github), placeholder: 'https://github.com/yourname' },
  instagram: { name: 'Instagram', icon: markRaw(Instagram), placeholder: 'https://instagram.com/yourname' },
  facebook: { name: 'Facebook', icon: markRaw(Facebook), placeholder: 'https://facebook.com/yourname' },
  youtube: { name: 'YouTube', icon: markRaw(Youtube), placeholder: 'https://youtube.com/@yourname' },
  tiktok: { name: 'TikTok', icon: markRaw(Tiktok), placeholder: 'https://tiktok.com/@yourname' },
  discord: { name: 'Discord', icon: markRaw(Discord), placeholder: 'https://discord.gg/invite' },
  threads: { name: 'Threads', icon: markRaw(Threads), placeholder: 'https://threads.net/@yourname' },
  mastodon: { name: 'Mastodon', icon: markRaw(Mastodon), placeholder: 'https://mastodon.social/@yourname' },
  website: { name: 'Website', icon: markRaw(Globe), placeholder: 'https://example.com' },
  email: { name: 'Email', icon: markRaw(Mail), placeholder: 'hello@example.com' },
}

export const socialNetworkList = Object.keys(SOCIAL_NETWORKS) as SocialNetwork[]
