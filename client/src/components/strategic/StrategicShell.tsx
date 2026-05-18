import { type ReactNode } from 'react'

import { PageHeader, type BreadcrumbItem } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/hooks/useCompany'

interface Props {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  children: (companyId: string) => ReactNode
}

/**
 * Common chrome for the 30+ strategic-lifecycle pages: page header, loading
 * state, and the "no company yet" empty state. The render callback receives
 * the resolved companyId so the inner page can fetch / mutate.
 */
export function StrategicShell({ title, description, breadcrumbs, actions, children }: Props) {
  const { company, loading, error } = useCompany()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={actions} />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardHeader>
            <CardTitle>Cannot load page</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Owner accounts: run /diagnostic/owner. Manager accounts: run /manager/diagnostic.
          </CardContent>
        </Card>
      )}

      {company && !loading && !error && children(company.id)}
    </div>
  )
}
