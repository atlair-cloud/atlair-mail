import { Closing } from '~/components/landing/closing'
import { Faq } from '~/components/landing/faq'
import { Features } from '~/components/landing/features'
import { Hero } from '~/components/landing/hero'
import { OpenSource } from '~/components/landing/open-source'
import { SiteShell } from '~/components/landing/site-shell'
import { Tour } from '~/components/landing/tour'
import { homeMeta } from '~/lib/seo'

export const meta = () => homeMeta()

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <Features />
      <Tour />
      <OpenSource />
      <Faq />
      <Closing />
    </SiteShell>
  )
}
