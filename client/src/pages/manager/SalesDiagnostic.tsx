import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import {
  SM_AXES, SM_CLASSIFY, SM_LEVEL_META, SM_QUESTIONS,
  classifyComplete, isB2C, smAllAnswered, smAnsweredScored, smLevelOf, smOverall, smResults,
  type SmAnswers, type SmAxisResult, type SmQuestion,
} from '@/lib/salesMaturity'
import { createInitiative, getArtifact, listInitiatives, upsertArtifact } from '@/lib/strategicApi'
import { NextAfterDiagnostic } from './MaturityInApp'

// ─── نضج المبيعات الموزون داخل التطبيق (لكل عميل) ───────────────────
// يحلّ محلّ التحليل العميق للمبيعات. تصنيف تكيّفي (قطاع→نوع→عميل) ثم ١٧
// سؤالاً على ٥ محاور بأوزان → نضج موزون + تقرير + مبادرات لأضعف المحاور.
// يُخزَّن في DEPT_DEEP_FULL: answers (نصوص للمستهلكين) + answerIdx (للمحرّك).

interface SmArtifactData {
  deptCode: string
  answers?: Record<string, string>       // تسميات — لتوافق SWOT/PESTEL
  answerIdx?: SmAnswers                   // فهارس — للمحرّك
  overallPct?: number
  diagnosticVersion?: string
}

// نبني خريطة تسميات (qid → نصّ الخيار) للتخزين المتوافق.
function labelMap(answers: SmAnswers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of SM_CLASSIFY) {
    const idx = answers[q.id]
    if (idx != null) out[q.id] = q.optionsFor(answers)[idx]?.label ?? ''
  }
  for (const q of SM_QUESTIONS) {
    const idx = answers[q.id]
    if (idx != null) out[q.id] = q.options[idx]?.label ?? ''
  }
  return out
}

export function SalesDiagnostic({ embedded = false }: { embedded?: boolean } = {}) {
  const scope = useClientScopedCompany()
  const company = scope.company
  const [answers, setAnswers] = useState<SmAnswers>({})
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
        const art = await getArtifact<SmArtifactData>(company.id, 'DEPT_DEEP_FULL')
        if (cancel) return
        const idx = art?.data?.deptCode === 'SALES' ? art.data.answerIdx : null
        if (idx && typeof idx === 'object') {
          const clean: SmAnswers = {}
          for (const [k, v] of Object.entries(idx)) if (typeof v === 'number') clean[k] = v
          setAnswers(clean)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل التشخيص السابق'))
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
        const payload: SmArtifactData = {
          deptCode: 'SALES', answerIdx: answers, answers: labelMap(answers),
          overallPct: smOverall(answers), diagnosticVersion: 'sales-maturity',
        }
        await upsertArtifact<SmArtifactData>(company.id, 'DEPT_DEEP_FULL', payload)
        setAutosave('saved')
      } catch { setAutosave('error') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [answers, company, loading])

  function choose(qid: string, optionIndex: number) {
    setAnswers((prev) => (prev[qid] === optionIndex ? prev : { ...prev, [qid]: optionIndex }))
    setGeneratedCount(null)
  }

  const results = useMemo(() => smResults(answers), [answers])
  const overall = smOverall(answers)
  const classified = classifyComplete(answers)
  const b2c = isB2C(answers)

  async function generatePlan() {
    if (!company) return
    setGenerating(true)
    try {
      const existing = await listInitiatives(company.id).catch(() => [])
      const existingTitles = new Set(existing.map((i) => i.title.trim()))
      const targets = results
        .filter((r) => r.answered > 0 && (r.level === 'start' || r.level === 'growth'))
        .sort((a, b) => a.pct - b.pct)
      let created = 0
      for (const r of targets) {
        const title = `تحسين ${r.labelAr}: ${r.recommendation}`.slice(0, 120)
        if (existingTitles.has(title)) continue
        try {
          await createInitiative({
            companyId: company.id,
            title,
            description: `من نضج المبيعات — المحور «${r.labelAr}» (${r.pct}٪ · ${SM_LEVEL_META[r.level].labelAr})`,
            priority: r.level === 'start' ? 'critical' : 'high',
            level: 'operational',
          })
          created++
        } catch { /* skip */ }
      }
      setGeneratedCount(created)
      if (created > 0) toast.success(`📥 ولّدت ${created} مبادرة لأضعف محاورك — نفّذها من المبادرات.`)
      else toast.message('كل المبادرات موجودة سلفاً.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد الخطة'))
    } finally { setGenerating(false) }
  }

  if (scope.loading || loading) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title="🔬 نضج المبيعات" />}
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }
  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title="🔬 نضج المبيعات" />}
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">لا يوجد عميل محدّد</CardTitle>
            <CardDescription className="text-rose-700">{scope.error ?? 'افتح التشخيص من لوحة العميل.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const overallLevel = SM_LEVEL_META[smLevelOf(overall)]
  const hasWeak = results.some((r) => r.answered > 0 && (r.level === 'start' || r.level === 'growth'))

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <PageHeader title="🔬 نضج المبيعات" description="تصنيف نشاطك ثم تقييم موزون على ٥ محاور → نضج وتقرير وخطّة." />
      )}

      {/* شريط النضج الموزون الحيّ */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold">نضج المبيعات (موزون)</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل' : ''}
              </span>
              <span className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${overallLevel.cls}`}>
                {overallLevel.emoji} {overall}٪ · {overallLevel.labelAr}
              </span>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-l from-primary to-emerald-500 transition-all" style={{ width: `${overall}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* التصنيف التكيّفي */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🏷️ تصنيف نشاطك</CardTitle>
          <CardDescription className="text-xs">يخصّص صياغة الأسئلة (لا يدخل في الدرجة).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {SM_CLASSIFY.map((cq, i) => {
            // نكشف السؤال فقط إذا سبقه مُجاب (تكيّفي).
            if (i > 0 && answers[SM_CLASSIFY[i - 1].id] == null) return null
            const opts = cq.optionsFor(answers)
            return (
              <div key={cq.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 text-sm font-medium">{cq.prompt}</div>
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((o, idx) => (
                    <button key={o.value} type="button" onClick={() => choose(cq.id, idx)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${answers[cq.id] === idx ? 'border-primary bg-primary/10 font-medium' : 'bg-card hover:border-primary/40 hover:bg-muted/40'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* المحاور المُسجَّلة — تظهر بعد اكتمال التصنيف */}
      {classified && SM_AXES.map((axis) => {
        const r = results.find((x) => x.key === axis.key)!
        return (
          <AxisCard key={axis.key} axis={axis} result={r} answers={answers} b2c={b2c} onChoose={choose} />
        )
      })}

      {classified && <ReportCard results={results} overall={overall} allComplete={smAllAnswered(answers)} answeredScored={smAnsweredScored(answers)} />}

      {hasWeak && (
        <Card className="overflow-hidden border-2 border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-emerald-900">🗓️ حوّل أضعف محاورك إلى خطّة</div>
              <p className="mt-0.5 text-xs text-emerald-800/80">مبادرة لكل محور «بداية/نمو» (الأولويّة من شدّته) → تُجلب كمهام.</p>
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

      {classified && <NextAfterDiagnostic companyId={company.id} />}
    </div>
  )
}

function AxisCard({ axis, result, answers, b2c, onChoose }: {
  axis: (typeof SM_AXES)[number]
  result: SmAxisResult
  answers: SmAnswers
  b2c: boolean
  onChoose: (qid: string, idx: number) => void
}) {
  const started = result.answered > 0
  const m = SM_LEVEL_META[result.level]
  const questions = axis.questionIds.map((id) => SM_QUESTIONS.find((q) => q.id === id)!).filter(Boolean)
  return (
    <Card className={`overflow-hidden border-2 ${started ? m.cls.split(' ')[0] : 'border-border'}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span aria-hidden>{axis.icon}</span>
          <span>المحور {axis.labelAr}</span>
          <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">وزن {axis.weight}٪</span>
          {started && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${m.cls}`}>{m.emoji} {result.pct}٪</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {questions.map((q) => (
          <QuestionRow key={q.id} q={q} b2c={b2c} selected={answers[q.id] ?? null} onChoose={(idx) => onChoose(q.id, idx)} />
        ))}
      </CardContent>
    </Card>
  )
}

function QuestionRow({ q, b2c, selected, onChoose }: {
  q: SmQuestion; b2c: boolean; selected: number | null; onChoose: (idx: number) => void
}) {
  const prompt = b2c && q.promptB2C ? q.promptB2C : q.prompt
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 text-sm font-medium">{prompt}</div>
      <div className="flex flex-wrap gap-1.5">
        {q.options.map((o, idx) => (
          <button key={idx} type="button" onClick={() => onChoose(idx)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${selected === idx ? 'border-primary bg-primary/10 font-medium' : 'bg-card hover:border-primary/40 hover:bg-muted/40'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReportCard({ results, overall, allComplete, answeredScored }: {
  results: SmAxisResult[]; overall: number; allComplete: boolean; answeredScored: number
}) {
  const scored = results.filter((r) => r.answered > 0)
  if (scored.length === 0) return null
  const level = SM_LEVEL_META[smLevelOf(overall)]
  const priorities = [...scored].sort((a, b) => a.pct - b.pct).filter((r) => r.level === 'start' || r.level === 'growth')
  return (
    <Card className="overflow-hidden border-2 border-primary/40">
      <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-emerald-500" />
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          📊 تقرير نضج المبيعات
          <span className={`rounded-full border px-2.5 py-0.5 text-sm font-bold tabular-nums ${level.cls}`}>{level.emoji} {overall}٪ · {level.labelAr}</span>
        </CardTitle>
        <CardDescription>{allComplete ? 'التقييم مكتمل — نضج موزون على ٥ محاور.' : `أجبت ${answeredScored}/${SM_QUESTIONS.length} سؤالاً — أكمل لتقرير دقيق.`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {results.map((r) => {
            const m = SM_LEVEL_META[r.level]
            return (
              <div key={r.key} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs font-medium">{r.icon} {r.labelAr}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${m.cls.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-primary'}`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-10 shrink-0 text-center text-[10px] text-muted-foreground">و{r.weight}٪</span>
                <span className={`w-14 shrink-0 rounded border px-1 py-0.5 text-center text-[10px] font-bold tabular-nums ${m.cls}`}>{m.emoji} {r.pct}٪</span>
              </div>
            )
          })}
        </div>
        {priorities.length > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="mb-1.5 text-xs font-bold">⚠️ أولويّات التحسين (الأضعف أوّلاً):</div>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              {priorities.map((r, i) => (
                <li key={r.key} className="flex items-start gap-2">
                  <span className="font-bold text-foreground tabular-nums">{i + 1}.</span>
                  <span><b className="text-foreground">{r.labelAr} ({r.pct}٪):</b> {r.recommendation}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
