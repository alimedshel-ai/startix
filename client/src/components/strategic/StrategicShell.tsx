import { type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageHeader, type BreadcrumbItem } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/hooks/useCompany'
import { JourneyProgress } from '@/journey/shared/JourneyProgress'
import { useAuthStore } from '@/store/authStore'

import { NextStepCard } from './NextStepCard'
import { StageBanner } from './StageBanner'

interface Props {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  /** أ٣ — شريط تبويبات اختياريّ يظهر تحت الترويسة (لوحات المالك الموحّدة). */
  tabs?: ReactNode
  children: (companyId: string) => ReactNode
}

/**
 * Common chrome for the 30+ strategic-lifecycle pages: page header, loading
 * state, and the "no company yet" empty state. The render callback receives
 * the resolved companyId so the inner page can fetch / mutate.
 */
export function StrategicShell({ title, description, breadcrumbs, actions, tabs, children }: Props) {
  const { company, loading, error } = useCompany()
  const viewer = useAuthStore((s) => s.user)
  // §٣-٤ — المسار الموجّه مخصّص للمدير المستقل؛ غيره يبقى بالسلوك السابق.
  const guided = viewer?.userType === 'MANAGER' && viewer?.managerType === 'INDEPENDENT_PRO'
  const [params] = useSearchParams()
  const clientQuery = params.get('client') ? `?client=${params.get('client')}` : ''
  const ready = !!company && !loading && !error

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={actions} />

      {tabs}

      {/* §٣ — شريط «أنت هنا» الواعي بالخطة (المستقل)، وإلا شريط التسلسل العام. */}
      {guided
        ? ready && <JourneyProgress companyId={company!.id} clientQuery={clientQuery} />
        : <StageBanner clientQuery={clientQuery} />}

      {/* رابط القمرة — عودة سريعة للشاشة الموجّهة من أي أداة (تفادي التشتّت). */}
      {guided && ready && (
        <Link
          to={`/manager/clients/${company!.id}/run`}
          className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs transition hover:bg-primary/10"
        >
          <span className="font-medium">🧭 تُهت؟ كل خطواتك في شاشة واحدة — القمرة الموجّهة</span>
          <span className="shrink-0 font-bold text-primary">تابِع المسار ←</span>
        </Link>
      )}

      {/* §٤ — بوصلة الإجراء الواحد مرفوعة للأعلى للمدير المستقل. */}
      {guided && ready && <NextStepCard clientQuery={clientQuery} companyId={company!.id} />}

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

      {ready && children(company!.id)}

      {/* S3 — بطاقة «الأداة التالية» أسفل الصفحة (غير المستقل فقط — رُفِعت للأعلى للمستقل §٤). */}
      {!guided && ready && <NextStepCard clientQuery={clientQuery} companyId={company!.id} />}
    </div>
  )
}
