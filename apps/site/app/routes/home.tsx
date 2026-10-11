import { Closing } from '~/components/landing/closing'
import { Faq } from '~/components/landing/faq'
import { Features } from '~/components/landing/features'
import { Flow } from '~/components/landing/flow'
import { Hero } from '~/components/landing/hero'
import { OpenSource } from '~/components/landing/open-source'
import { SiteShell } from '~/components/landing/site-shell'
import { UseCaseMarquee } from '~/components/landing/use-case-marquee'
import { homeMeta } from '~/lib/seo'

export const meta = () => homeMeta()

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <Flow />
      <Features />
      <UseCaseMarquee />
      <OpenSource />
      <Faq />
      <Closing />
    </SiteShell>
  )
}
