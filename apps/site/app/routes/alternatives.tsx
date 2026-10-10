import { AlternativesHub } from '~/components/landing/alternatives-hub'
import { SiteShell } from '~/components/landing/site-shell'
import { hubMeta } from '~/lib/seo'

export const meta = () => hubMeta()

export default function Alternatives() {
  return (
    <SiteShell>
      <AlternativesHub />
    </SiteShell>
  )
}
