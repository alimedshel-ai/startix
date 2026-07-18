import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import {
  generateRecommendations,
  listRecommendations,
  SOURCE_LABEL,
  type Recommendation,
  type RecommendationSeverity,
} from '@/lib/insightApi'

import { PortfolioCompanySelect, usePortfolioCompanies } from './_shared'

// ─── توصيات AI لشركات المحفظة ───────────────────────────────────────────────
// نعيد استخدام محرّك الاستدلال (C16 / /api/insight) لكن بمنظور المستثمر:
// اختر شركة من المحفظة ثم ولّد/اعرض توصياتها الحتمية.

const SEVERITY_STYLE: Record<RecommendationSeverity, string> = {
  critical: 'border-rose-500/40 bg-rose-500/5 text-rose-800 dark:text-rose-200',
  warning: 'border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200',
  info: 'border-sky-500/40 bg-sky-500/5 text-sky-800 dark:text-sky-200',
}

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
  critical: 'حرِج',
  warning: 'تنبيه',
  info: 'معلومة',
}

export function InvestorRecommendationsPage() {
  return (
    <ErrorBoundary>
      <InvestorRecommendationsContent />
    </ErrorBoundary>
  )
}

function InvestorRecommendationsContent() {
  const { companies, loading, error } = usePortfolioCompanies()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!companyId) {
      setRecs([])
      return
    }
    let cancel = false
    setLoadingData(true)
    ;(async () => {
      try {
        const rows = await listRecommendations(companyId)
        if (!cancel) setRecs(rows)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل التوصيات'))
      } finally {
        if (!cancel) setLoadingData(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [companyId])

  async function generate() {
    if (!companyId) return
    setGenerating(true)
    try {
      const res = await generateRecommendations(companyId)
      setRecs(res.recommendations)
      toast.success(`تم توليد ${res.generated.toLocaleString('ar-SA')} توصية`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد التوصيات'))
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="🤖 توصيات AI للاستثمار" />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري تحميل المحفظة…" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="🤖 توصيات AI للاستثمار"
        description="توصيات حتمية مبنيّة على تشخيص الشركة وتدقيق أقسامها ونقطة تعادلها."
      />

      {companies.length === 0 ? (
        <EmptyState
          title="محفظتك فارغة"
          description="لم يتم ربطك بأي شركة بعد. ستظهر التوصيات هنا فور ربطك بشركة."
          icon={<span className="text-4xl">💼</span>}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <PortfolioCompanySelect companies={companies} value={companyId} onChange={setCompanyId} />
              </div>
              <Button onClick={generate} disabled={!companyId || generating}>
                {generating ? 'جاري التوليد…' : 'ولّد التوصيات'}
              </Button>
            </CardContent>
          </Card>

          {!companyId ? (
            <EmptyState
              title="اختر شركة من محفظتك"
              description="اختر شركة أعلاه ثم اضغط «ولّد التوصيات»."
              icon={<span className="text-4xl">🤖</span>}
            />
          ) : loadingData ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" label="جاري تحميل التوصيات…" />
            </div>
          ) : recs.length === 0 ? (
            <EmptyState
              title="لا توجد توصيات بعد"
              description="اضغط «ولّد التوصيات» لإنشاء أول قراءة لهذه الشركة."
              icon={<span className="text-4xl">✨</span>}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {recs.map((r) => (
                <li key={r.id} className={`rounded-lg border px-4 py-3 text-sm ${SEVERITY_STYLE[r.severity]}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border bg-card/60 px-2 py-0.5 text-[10px] font-semibold">
                      {SEVERITY_LABEL[r.severity]}
                    </span>
                    <span className="rounded-full border bg-card/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </span>
                  </div>
                  <p className="mt-2 leading-relaxed">{r.message}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}
