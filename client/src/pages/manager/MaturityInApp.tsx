import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { MaturityAssessment, MaturityReport } from '@/components/maturity/MaturityAssessment'
import { HrQuantitativeSection } from '@/components/maturity/HrQuantitativeSection'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { useGuidedNext } from '@/hooks/useGuidedNext'
import { apiErrorMessage } from '@/lib/api'
import { ANALYSIS_TOOLS } from '@/lib/analysisPlan'
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
  const [staleSchema, setStaleSchema] = useState(false)
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
    setStaleSchema(false)
    skipFirst.current = true
    ;(async () => {
      try {
        const art = await getArtifact<MaturityArtifact>(company.id, 'MATURITY')
        if (cancel) return
        const a = art?.data?.specialty === config.specialty ? art.data.answers : null
        if (a && typeof a === 'object') {
          const clean: MaturityAnswers = {}
          for (const [k, v] of Object.entries(a)) if (typeof v === 'number') clean[k] = v
          // سقوط آمن لأي مخطّط قديم (drift إصدار): إن حُفظت إجابات لكن لا يطابق
          // أيٌّ منها أسئلة النموذج الحاليّ، لا نعرض تقييماً فارغاً صامتاً — نبدأ
          // نظيفاً ونُعلِم المستخدم. غير مُتلِف: القديم يبقى حتى أوّل إجابة جديدة.
          const currentIds = new Set(config.sections.flatMap((s) => s.questions.map((q) => q.id)))
          const matched = Object.keys(clean).filter((k) => currentIds.has(k)).length
          if (Object.keys(clean).length > 0 && matched === 0) setStaleSchema(true)
          else setAnswers(clean)
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

      {staleSchema && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-4 text-sm text-amber-900">
            ⚠️ لديك تقييم سابق بإصدارٍ قديم من هذا النموذج لم يعد متوافقاً مع الأسئلة الحاليّة —
            ابدأ تقييماً جديداً أدناه (يحلّ محلّ القديم عند أوّل إجابة). لم نحذف بياناتك القديمة.
          </CardContent>
        </Card>
      )}

      <MaturityAssessment config={config} answers={answers} onSelect={onSelect} />
      <MaturityReport config={config} answers={answers} />

      {config.specialty === 'HR' && (
        <HrQuantitativeSection
          companyId={company.id}
          prefill={{ headcount: company.opex?.team, avgMonthlySalary: company.opex?.avgSalary }}
        />
      )}

      {weakSections.length > 0 && (
        <Card className="overflow-hidden border-2 border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-emerald-900">🗓️ مسار سريع (اختياري): عالِج أضعف الأقسام الآن</div>
              <p className="mt-0.5 text-xs text-emerald-800/80">مبادرة تحسين لكل قسم ضعيف (الأولويّة من شدّته) → تُجلب كمهام. مكمّل للمسار الاستراتيجي، لا بديل عنه.</p>
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

      <NextAfterDiagnostic companyId={company.id} />
    </div>
  )
}

// ─── بوصلة «أين أنت الآن» بعد التشخيص ───────────────────────────────
// التشخيص = مرحلة القياس ① في المنهجيّة (قِس→صنّف→وجّه→نفّذ→أعِد القياس).
// لا نقفز للمبادرات ⑤ — بل نعرض الخطوة المنهجيّة الصحيحة من مصدر الحقيقة
// الواحد (useGuidedNext): عميل مؤسّس → التوليف/SWOT ②؛ طوارئ → الإنقاذ.
// توليد مبادرات الأضعف يبقى «مساراً سريعاً اختياريّاً» (البطاقة الخضراء
// أعلاه)، لا «الخطوة التالية» — لذا أُزيل زرّاه المكرّران من هنا.
// مسارات أدوات القياس ① — من مصدر المحرّك نفسه (ANALYSIS_TOOLS)، قراءة لا مُقرِّر ثانٍ.
const MEASURE_PATHS = new Set(Object.values(ANALYSIS_TOOLS).map((t) => t.path).filter(Boolean))

export function NextAfterDiagnostic({ companyId }: { companyId: string }) {
  const { loading, next } = useGuidedNext(companyId)
  // العنوان ديناميكيّ: إن كانت وجهة «التالي» أداةَ قياس ① (أو تدقيقاً) فالقياس
  // لم يكتمل → «تابِع»، لا «أنهيتَ» — يمنع «أنهيتَ ① ← أكمل PESTEL» المتناقض.
  const dest = next?.to?.split('?')[0] ?? ''
  const stillMeasuring = MEASURE_PATHS.has(dest) || dest.endsWith('/audit')
  const title = stillMeasuring
    ? '🧭 تابِع القياس ① — خطوتك التالية'
    : '🧭 أنهيتَ القياس ① — الخطوة التالية في مسارك'
  return (
    <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-sm font-bold">{title}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading
              ? 'نحسب خطوتك التالية…'
              : next?.reason ?? 'التشخيص مرحلة قياس — تابع مسارك الاستراتيجي من الشريط الجانبي.'}
          </p>
        </div>
        {!loading && next?.to && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={next.to} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90">
              {next.icon} {next.label} ←
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
