import { AlternativePage } from '~/components/landing/alternative-page'
import { SiteShell } from '~/components/landing/site-shell'
import { Container, PrimaryCta } from '~/components/landing/shared'
import { alternativeMeta } from '~/lib/seo'
import { findAlternative } from '~/seo/alternatives'

import type { Route } from './+types/alternative'

export const meta: Route.MetaFunction = ({ params }) => alternativeMeta(params.slug)

export default function Alternative({ params }: Route.ComponentProps) {
  const alt = findAlternative(params.slug)
  return (
    <SiteShell>
      {alt ? (
        <AlternativePage alt={alt} />
      ) : (
        <Container className="py-32">
          <h1 className="font-serif text-6xl">This letter got lost.</h1>
          <PrimaryCta href="/alternatives" className="mt-8">
            See all comparisons
          </PrimaryCta>
        </Container>
      )}
    </SiteShell>
  )
}
