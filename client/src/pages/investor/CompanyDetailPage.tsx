import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { PathBadge, pathLabel } from '@/components/PathBadge'
import { RadarChart, type RadarDatum } from '@/components/charts/RadarChart'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiErrorMessage } from '@/lib/api'
import type { Company } from '@/lib/deptApi'
import type { OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'

const SIZE_LABEL: Record<Company['size'], string> = {
  MICRO: 'متناهية الصغر',
  SMALL: 'صغيرة',
  MEDIUM: 'متوسطة',
  LARGE: 'كبيرة',
}

const AXIS_LABEL_AR: Record<string, string> = {
  Governance: 'الحوكمة',
  Financial: 'المالية',
  Team: 'الفريق',
  Digital: 'الرقمي',
}

export function CompanyDetailPage() {
  return (
    <ErrorBoundary>
      <CompanyDetailContent />
    </ErrorBoundary>
  )
}

function CompanyDetailContent() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [result, setResult] = useState<OwnerDiagnosticResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [companyError, setCompanyError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancel = false
    ;(async () => {
      try {
        // بيانات الشركة أولاً — إن فشلت نعرض حالة خطأ. غياب التشخيص طبيعي (404).
        const { data: companyData } = await api.get<Company>(`/api/companies/${id}`)
        if (cancel) return
        setCompany(companyData)

        try {
          const { data: diag } = await api.get<{ result: OwnerDiagnosticResult | null }>(
            `/api/diagnostic/${id}/latest`
          )
          if (!cancel && diag.result) setResult(diag.result)
        } catch {
          // 404 = لا تشخيص بعد. نتركها null ونعرض EmptyState لجزء التشخيص.
        }
      } catch (err) {
        if (!cancel) {
          const msg = apiErrorMessage(err, 'تعذّر تحميل بيانات الشركة')
          setCompanyError(msg)
          toast.error(msg)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تفاصيل الشركة" description="عرض قراءة فقط من محفظتك." />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري التحميل…" />
        </div>
      </div>
    )
  }

  if (companyError || !company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تفاصيل الشركة" />
        <EmptyState
          title="لم نتمكن من فتح الشركة"
          description={companyError ?? 'قد تكون الشركة غير موجودة أو ليس لديك صلاحية عرضها.'}
          icon={<span className="text-4xl">🚫</span>}
          action={
            <Link to="/investor/portfolio" className={buttonVariants({ variant: 'outline' })}>
              العودة للمحفظة
            </Link>
          }
        />
      </div>
    )
  }

  const radarTranslated: RadarDatum[] = result
    ? result.radarData.map((r) => ({ axis: AXIS_LABEL_AR[r.axis] ?? r.axis, value: r.value }))
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={company.name}
        description={`${company.sector ?? '—'} · ${SIZE_LABEL[company.size]}${company.stage ? ` · ${company.stage}` : ''} · ${company.country}`}
        actions={
          <Link to="/investor/portfolio" className={buttonVariants({ variant: 'ghost' })}>
            ← المحفظة
          </Link>
        }
      />

      {!result ? (
        <EmptyState
          title="لم يُجرَ تشخيص بعد"
          description="سيظهر مسارك الاستراتيجي، درجة النضج، ورسم القدرات الراداري هنا فور إنجاز أول تشخيص لهذه الشركة."
          icon={<span className="text-4xl">🎯</span>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-12">
          <Card className="md:col-span-5">
            <CardHeader>
              <CardDescription>المسار الاستراتيجي الحالي</CardDescription>
              <CardTitle className="flex items-center gap-3">
                <PathBadge path={result.strategicPath} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-bold tabular-nums text-primary">
                  {result.maturityScore}
                </div>
                <div className="text-sm text-muted-foreground">/ 100 درجة النضج</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                تصنيف مسار الشركة الحالي: {pathLabel(result.strategicPath)}.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-7">
            <CardHeader>
              <CardTitle>رسم القدرات الراداري</CardTitle>
              <CardDescription>
                الحوكمة · المالية · الفريق · الرقمي — كل محور 0–100.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadarChart data={radarTranslated} />
            </CardContent>
          </Card>

          <Card className="md:col-span-12">
            <CardHeader>
              <CardTitle>أبرز نقاط الضعف</CardTitle>
              <CardDescription>الأبعاد الأقل تقييماً في آخر تشخيص.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.weaknesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد نقاط ضعف مرصودة.</p>
              ) : (
                <ul className="grid gap-2">
                  {result.weaknesses.map((w) => (
                    <li
                      key={w.key}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm"
                    >
                      <span>{w.label}</span>
                      <span className="tabular-nums font-medium text-muted-foreground">
                        {w.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
