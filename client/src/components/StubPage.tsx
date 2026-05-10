import type { ReactNode } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { PageHeader, type BreadcrumbItem } from '@/components/PageHeader'

interface Props {
  title: string
  description?: string
  phase?: number
  breadcrumbs?: BreadcrumbItem[]
  action?: ReactNode
}

// Placeholder for routes whose backend or feature work lands in a later phase.
// Keeps the navigation graph reachable so we can wire the sidebar end-to-end now.
export function StubPage({ title, description, phase, breadcrumbs, action }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />
      <EmptyState
        title={`${title} — coming soon`}
        description={
          phase
            ? `This page is scaffolded; full functionality lands in Phase ${phase} per the build plan.`
            : 'Scaffolded route; functionality lands in a later phase per the build plan.'
        }
        action={action}
      />
    </div>
  )
}
