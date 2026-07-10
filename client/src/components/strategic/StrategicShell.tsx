import { type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader, type BreadcrumbItem } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/hooks/useCompany'

import { NextStepCard } from './NextStepCard'
import { StageBanner } from './StageBanner'

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
  const [params] = useSearchParams()
  const clientQuery = params.get('client') ? `?client=${params.get('client')}` : ''

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={actions} />

      {/* S1 — شريط تسلسل مرئي في أعلى كل أداة استراتيجية. */}
      <StageBanner clientQuery={clientQuery} />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري التحميل…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">تعذّر تحميل الصفحة</CardTitle>
            <CardDescription className="text-rose-700">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            حسابات المالك: شغّل التشخيص من <code className="rounded bg-muted px-1.5 py-0.5">/diagnostic/owner</code>.
            حسابات المدير: شغّل التشخيص من <code className="rounded bg-muted px-1.5 py-0.5">/manager/diagnostic</code>.
          </CardContent>
        </Card>
      )}

      {company && !loading && !error && children(company.id)}

      {/* S3 — بطاقة «الأداة التالية» في نهاية الصفحة. */}
      {company && !loading && !error && <NextStepCard clientQuery={clientQuery} />}
    </div>
  )
}
