import { Container, PrimaryCta } from '~/components/landing/shared'
import { SiteShell } from '~/components/landing/site-shell'
import { UseCasePage } from '~/components/landing/use-case-page'
import { useCaseMeta } from '~/lib/seo'
import { findUseCase } from '~/seo/use-cases'

import type { Route } from './+types/use-case'

export const meta: Route.MetaFunction = ({ params }) => useCaseMeta(params.slug)

export default function UseCase({ params }: Route.ComponentProps) {
  const useCase = findUseCase(params.slug)
  return (
    <SiteShell>
      {useCase ? (
        <UseCasePage useCase={useCase} />
      ) : (
        <Container className="py-32">
          <h1 className="font-serif text-6xl">This letter got lost.</h1>
          <PrimaryCta href="/use-cases" className="mt-8">
            See all use cases
          </PrimaryCta>
        </Container>
      )}
    </SiteShell>
  )
}
