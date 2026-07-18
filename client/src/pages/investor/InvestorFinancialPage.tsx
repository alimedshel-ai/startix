import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import {
  getLatestDupont,
  getLatestMonteCarloRun,
  type DupontAnalysis,
  type MonteCarloRun,
} from '@/lib/financeApi'
import { DupontCard, MonteCarloCard } from '@/pages/owner/FinancialAnalysisPage'

import { PortfolioCompanySelect, usePortfolioCompanies } from './_shared'

// ─── تحليل مالي لشركات المحفظة (Dupont / Monte Carlo) ───────────────────────
// نفس محرّك التحليل المالي للمالك، لكن مُوجّه للمستثمر: يختار شركة من محفظته
// ثم يشغّل التحليل على معرّفها. نعيد استخدام DupontCard / MonteCarloCard
// المُصدَّرتين من صفحة المالك — مصدر واحد للحقيقة، بلا تكرار منطق.

type Tool = 'dupont' | 'monte-carlo'

const META: Record<Tool, { title: string; description: string; emptyIcon: string }> = {
  dupont: {
    title: '📐 تحليل Dupont — شركات المحفظة',
    description: 'فكّك العائد على حقوق الملكية (ROE) لأي شركة في محفظتك إلى محرّكاته الثلاثة.',
    emptyIcon: '📐',
  },
  'monte-carlo': {
    title: '🎲 محاكاة Monte Carlo — شركات المحفظة',
    description: 'شغّل آلاف السيناريوهات لتوقّع توزيع أرباح شركة في محفظتك ومستوى مخاطرها.',
    emptyIcon: '🎲',
  },
}

export function InvestorFinancialPage({ tool }: { tool: Tool }) {
  return (
    <ErrorBoundary>
      <InvestorFinancialContent tool={tool} />
    </ErrorBoundary>
  )
}

function InvestorFinancialContent({ tool }: { tool: Tool }) {
  const meta = META[tool]
  const { companies, loading, error } = usePortfolioCompanies()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [dupont, setDupont] = useState<DupontAnalysis | null>(null)
  const [mc, setMc] = useState<MonteCarloRun | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  const selected = companies.find((c) => c.id === companyId) ?? null

  useEffect(() => {
    if (!companyId) {
      setDupont(null)
      setMc(null)
      return
    }
    let cancel = false
    setLoadingData(true)
    ;(async () => {
      try {
        if (tool === 'dupont') {
          const d = await getLatestDupont(companyId)
          if (!cancel) setDupont(d)
        } else {
          const m = await getLatestMonteCarloRun(companyId)
          if (!cancel) setMc(m)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل التحليل'))
      } finally {
        if (!cancel) setLoadingData(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [companyId, tool])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={meta.title} description={meta.description} />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري تحميل المحفظة…" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={meta.title} description={meta.description} />

      {companies.length === 0 ? (
        <EmptyState
          title="محفظتك فارغة"
          description="لم يتم ربطك بأي شركة بعد. سيظهر التحليل هنا فور ربطك بشركة."
          icon={<span className="text-4xl">💼</span>}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <PortfolioCompanySelect companies={companies} value={companyId} onChange={setCompanyId} />
            </CardContent>
          </Card>

          {!selected ? (
            <EmptyState
              title="اختر شركة من محفظتك"
              description="اختر شركة أعلاه لعرض التحليل وحفظ نتيجة جديدة."
              icon={<span className="text-4xl">{meta.emptyIcon}</span>}
            />
          ) : loadingData ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" label="جاري تحميل التحليل…" />
            </div>
          ) : tool === 'dupont' ? (
            <DupontCard companyId={selected.id} initial={dupont} onSaved={setDupont} preset={null} opex={selected.opex} />
          ) : (
            <MonteCarloCard companyId={selected.id} initial={mc} onSaved={setMc} preset={null} opex={selected.opex} />
          )}
        </>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}
