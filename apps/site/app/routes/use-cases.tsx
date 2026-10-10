import { SiteShell } from '~/components/landing/site-shell'
import { UseCasesHub } from '~/components/landing/use-cases-hub'
import { useCaseHubMeta } from '~/lib/seo'

export const meta = () => useCaseHubMeta()

export default function UseCases() {
  return (
    <SiteShell>
      <UseCasesHub />
    </SiteShell>
  )
}
