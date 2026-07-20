import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { MaturityAssessment, MaturityReport } from '@/components/maturity/MaturityAssessment'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { computeOverall, computeResults, type MaturityAnswers, type MaturityConfig } from '@/lib/maturityEngine'
import { createInitiative, getArtifact, listInitiatives, upsertArtifact } from '@/lib/strategicApi'

// ─── تقييم النضج داخل التطبيق (معمّم، لكل عميل) ─────────────────────
// يحلّ محلّ التحليل العميق لتخصّصات النضج. يقرأ/يكتب artifact 'MATURITY'
// (موسوماً بالتخصّص) لكل عميل، ويولّد مبادرات لأضعف الأقسام.

interface MaturityArtifact {
  specialty: string
  answers: MaturityAnswers
  overallPct?: number
}

export function MaturityInApp({ config, embedded = false }: { config: MaturityConfig; embedded?: boolean }) {
  const scope = useClientScopedCompany()
  const company = scope.company
  const [answers, setAnswers] = useState<MaturityAnswers>({})
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
        const art = await getArtifact<MaturityArtifact>(company.id, 'MATURITY')
        if (cancel) return
        const a = art?.data?.specialty === config.specialty ? art.data.answers : null
        if (a && typeof a === 'object') {
          const clean: MaturityAnswers = {}
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
  }, [company, scope.loading, config.specialty])

  useEffect(() => {
    if (!company || loading) return
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        const payload: MaturityArtifact = { specialty: config.specialty, answers, overallPct: computeOverall(config, answers).maturityPct }
        await upsertArtifact<MaturityArtifact>(company.id, 'MATURITY', payload)
        setAutosave('saved')
      } catch { setAutosave('error') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [answers, company, loading, config])

  function onSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
    setGeneratedCount(null)
  }

  const weakSections = useMemo(
    () => computeResults(config, answers).filter((r) => r.answered > 0 && r.pct < 60).sort((a, b) => a.pct - b.pct),
    [config, answers],
  )

  async function generatePlan() {
    if (!company) return
    setGenerating(true)
    try {
      const existing = await listInitiatives(company.id).catch(() => [])
      const existingTitles = new Set(existing.map((i) => i.title.trim()))
      let created = 0
      for (const r of weakSections) {
        const title = `تحسين ${r.labelAr}: ${r.recommendation}`.slice(0, 120)
        if (existingTitles.has(title)) continue
        try {
          await createInitiative({
            companyId: company.id, title,
            description: `من ${config.titleAr} — القسم «${r.labelAr}» (${r.pct}٪)`,
            priority: r.pct < 40 ? 'critical' : 'high', level: 'operational',
          })
          created++
        } catch { /* skip */ }
      }
      setGeneratedCount(created)
      if (created > 0) toast.success(`📥 ولّدت ${created} مبادرة لأضعف أقسامك — نفّذها من المبادرات.`)
      else toast.message('كل مبادرات التحسين موجودة سلفاً.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد الخطة'))
    } finally { setGenerating(false) }
  }

  if (scope.loading || loading) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title={`🔬 ${config.titleAr}`} />}
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }
  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title={`🔬 ${config.titleAr}`} />}
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">لا يوجد عميل محدّد</CardTitle>
            <CardDescription className="text-rose-700">{scope.error ?? 'افتح التقييم من لوحة العميل.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {!embedded && <PageHeader title={`🔬 ${config.titleAr}`} description={config.descAr} />}

      <div className="flex justify-end text-xs text-muted-foreground">
        {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
      </div>

      <MaturityAssessment config={config} answers={answers} onSelect={onSelect} />
      <MaturityReport config={config} answers={answers} />

      {weakSections.length > 0 && (
        <Card className="overflow-hidden border-2 border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-emerald-900">🗓️ حوّل أضعف الأقسام إلى خطّة</div>
              <p className="mt-0.5 text-xs text-emerald-800/80">مبادرة تحسين لكل قسم ضعيف (الأولويّة من شدّته) → تُجلب كمهام.</p>
              {generatedCount != null && generatedCount > 0 && (
                <div className="mt-1 text-xs font-medium text-emerald-800">
                  ✓ أُنشئت {generatedCount} مبادرة · <Link to={`/priority?tab=initiatives&client=${company.id}`} className="underline underline-offset-2">افتح المبادرات ←</Link>
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
