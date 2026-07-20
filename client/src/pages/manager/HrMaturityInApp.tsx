import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { computeHrOverall, computeHrResults, type HrAnswers } from '@/lib/hrMaturity'
import { createInitiative, getArtifact, listInitiatives, upsertArtifact } from '@/lib/strategicApi'

import { HrMaturityDiagnostic, HrMaturityReport } from './HrMaturityDiagnostic'

// ─── تقييم نضج HR داخل التطبيق (بعد التسجيل، لكل عميل) ───────────────
// يحلّ محلّ التحليل العميق لتخصّص HR (كتشخيص المبيعات للمبيعات). يقرأ/يكتب
// artifact 'HR_MATURITY' لكل عميل، ويولّد مبادرات لأضعف الأقسام.

interface HrArtifactData {
  answers: HrAnswers
  overallPct?: number
}

export function HrMaturityInApp({ embedded = false }: { embedded?: boolean } = {}) {
  const scope = useClientScopedCompany()
  const company = scope.company
  const [answers, setAnswers] = useState<HrAnswers>({})
  const [loading, setLoading] = useState(true)
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [generating, setGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirst = useRef(true)

  useEffect(() => {
    if (scope.loading) return
    if (!company) { setLoading(false); return }
    let cancel = false
    setLoading(true)
    setAnswers({})
    skipFirst.current = true
    ;(async () => {
      try {
        const art = await getArtifact<HrArtifactData>(company.id, 'HR_MATURITY')
        if (cancel) return
        const a = art?.data?.answers
        if (a && typeof a === 'object') {
          const clean: HrAnswers = {}
          for (const [k, v] of Object.entries(a)) if (typeof v === 'number') clean[k] = v
          setAnswers(clean)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل التقييم السابق'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [company, scope.loading])

  useEffect(() => {
    if (!company || loading) return
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        const payload: HrArtifactData = { answers, overallPct: computeHrOverall(answers).maturityPct }
        await upsertArtifact<HrArtifactData>(company.id, 'HR_MATURITY', payload)
        setAutosave('saved')
      } catch {
        setAutosave('error')
      }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [answers, company, loading])

  function onSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
    setGeneratedCount(null)
  }

  // توليد مبادرات لأضعف الأقسام (ضعيف→critical، ناشئ→high · level=operational).
  async function generatePlan() {
    if (!company) return
    setGenerating(true)
    try {
      const existing = await listInitiatives(company.id).catch(() => [])
      const existingTitles = new Set(existing.map((i) => i.title.trim()))
      const targets = computeHrResults(answers)
        .filter((r) => r.answered > 0 && (r.level === 'weak' || r.level === 'emerging'))
        .sort((a, b) => a.pct - b.pct)
      let created = 0
      for (const r of targets) {
        const title = `تحسين ${r.labelAr}: ${r.recommendation}`.slice(0, 120)
        if (existingTitles.has(title)) continue
        try {
          await createInitiative({
            companyId: company.id,
            title,
            description: `من تقييم نضج HR — القسم «${r.labelAr}» (${r.pct}٪ · ${r.level === 'weak' ? 'ضعيف' : 'ناشئ'})`,
            priority: r.level === 'weak' ? 'critical' : 'high',
            level: 'operational',
          })
          created++
        } catch { /* skip */ }
      }
      setGeneratedCount(created)
      if (created > 0) toast.success(`📥 ولّدت ${created} مبادرة لأضعف أقسامك — نفّذها من صفحة المبادرات.`)
      else toast.message('كل مبادرات التحسين موجودة سلفاً.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد الخطة'))
    } finally {
      setGenerating(false)
    }
  }

  if (scope.loading || loading) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title="🔬 تقييم نضج الموارد البشريّة" />}
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title="🔬 تقييم نضج الموارد البشريّة" />}
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">لا يوجد عميل محدّد</CardTitle>
            <CardDescription className="text-rose-700">{scope.error ?? 'افتح التقييم من لوحة العميل.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const hasWeak = computeHrResults(answers).some((r) => r.answered > 0 && (r.level === 'weak' || r.level === 'emerging'))

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <PageHeader
          title="🔬 تقييم نضج الموارد البشريّة"
          description="١٠ أقسام × ١٠ أسئلة → نضج لكل قسم + توصيات — وحفظ آلي لكل عميل."
        />
      )}

      <div className="flex justify-end text-xs text-muted-foreground">
        {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
      </div>

      <HrMaturityDiagnostic answers={answers} onSelect={onSelect} />
      <HrMaturityReport answers={answers} />

      {hasWeak && (
        <Card className="overflow-hidden border-2 border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-emerald-900">🗓️ حوّل أضعف الأقسام إلى خطّة</div>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                نُنشئ مبادرة تحسين لكل قسم ضعيف/ناشئ (الأولويّة من شدّته)، ثم تجلبها كمهام من المبادرات.
              </p>
              {generatedCount != null && generatedCount > 0 && (
                <div className="mt-1 text-xs font-medium text-emerald-800">
                  ✓ أُنشئت {generatedCount} مبادرة ·{' '}
                  <Link to={`/priority?tab=initiatives&client=${company.id}`} className="underline underline-offset-2">افتح المبادرات ←</Link>
                </div>
              )}
            </div>
            <Button onClick={generatePlan} disabled={generating} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
              {generating ? 'جاري التوليد…' : '📥 ولّد خطّة التحسين'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
