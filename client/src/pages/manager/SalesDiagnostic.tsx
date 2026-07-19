import { useEffect, useMemo, useRef, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import {
  SALES_AXES, ZONE_META,
  allAxesComplete, axisComplete, axisFlow, computeResults, overallScore, zoneOf,
  type AxisResult, type DiagAnswers, type DiagQuestion, type SalesAxisKey,
} from '@/lib/salesDiagnostic'
import { getProOverview } from '@/lib/proApi'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { toast } from 'sonner'

// ─── تشخيص المبيعات التكيّفي (المرحلة ٢: المعالج) ───────────────────
// يحلّ محلّ التحليل العميق للمبيعات. wizard تكيّفي: كل إجابة تكشف التالي،
// ومعها التشخيص + الحلّ. يُخزَّن في DEPT_DEEP_FULL بشكل متوافق (answers)
// حتى لا يكسر مستهلكيه (SWOT/PESTEL/البيئة الداخليّة).

interface DiagData {
  deptCode: string
  answers: DiagAnswers
  scores?: Record<string, number | null>
  diagnosticVersion?: string
}

export function SalesDiagnostic({ embedded = false }: { embedded?: boolean } = {}) {
  const scope = useClientScopedCompany()
  const company = scope.company
  const [answers, setAnswers] = useState<DiagAnswers>({})
  const [loading, setLoading] = useState(true)
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [auditHealth, setAuditHealth] = useState<number | null>(null)
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
        const art = await getArtifact<DiagData>(company.id, 'DEPT_DEEP_FULL')
        if (cancel) return
        if (art?.data?.deptCode === 'SALES' && art.data.answers && typeof art.data.answers === 'object') {
          // نأخذ فقط قيم النصوص المطابقة لمفاتيح التشخيص (تجاهل أي شكل قديم).
          const clean: DiagAnswers = {}
          for (const [k, v] of Object.entries(art.data.answers)) {
            if (typeof v === 'string') clean[k] = v
          }
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

  // حفظ آلي بعد 1000ms — يخزّن الإجابات + الدرجات المحسوبة.
  useEffect(() => {
    if (!company || loading) return
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        const scores = Object.fromEntries(computeResults(answers).map((r) => [r.axis, r.score]))
        const payload: DiagData = { deptCode: 'SALES', answers, scores, diagnosticVersion: 'sales-adaptive' }
        await upsertArtifact<DiagData>(company.id, 'DEPT_DEEP_FULL', payload)
        setAutosave('saved')
      } catch {
        setAutosave('error')
      }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [answers, company, loading])

  // مصالحة عرضيّة مع صحّة التدقيق (بلا دمج رقمي) — best-effort.
  useEffect(() => {
    if (!company) return
    let cancel = false
    getProOverview()
      .then((res) => {
        if (cancel) return
        const c = res.clients.find((x) => x.companyId === company.id)
        setAuditHealth(c?.healthPct ?? null)
      })
      .catch(() => undefined)
    return () => { cancel = true }
  }, [company])

  const results = useMemo(() => computeResults(answers), [answers])
  const overall = overallScore(answers)
  const completedAxes = SALES_AXES.filter((a) => axisComplete(a.key, answers)).length
  const allComplete = allAxesComplete(answers)

  function choose(qid: string, value: string) {
    // تغيير إجابة أعلى قد يُيتّم إجابات أعمق — لكنها تُتجاهَل تلقائياً في
    // axisFlow/axisScore (لا تُعرَض ولا تُحسَب)، فلا حاجة لمسحها يدوياً.
    setAnswers((prev) => (prev[qid] === value ? prev : { ...prev, [qid]: value }))
  }

  if (scope.loading || loading) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title="🔬 تشخيص المبيعات" />}
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        {!embedded && <PageHeader title="🔬 تشخيص المبيعات" />}
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">لا يوجد عميل محدّد</CardTitle>
            <CardDescription className="text-rose-700">{scope.error ?? 'افتح التشخيص من لوحة العميل.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <PageHeader
          title="🔬 تشخيص المبيعات التكيّفي"
          description="خمسة محاور تُكشف تدريجياً — كل إجابة تفتح التالية، ومعها التشخيص والحلّ."
        />
      )}

      {/* شريط التقدّم + الدرجة الكليّة الحيّة */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-sm font-bold">تقدّم التشخيص</div>
            <div className="text-xs text-muted-foreground">
              أكملت <b className="text-foreground tabular-nums">{completedAxes}</b> من {SALES_AXES.length} محاور
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
            </span>
            {overall != null && (
              <span className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${ZONE_META[zoneOf(overall)!].cls}`}>
                {ZONE_META[zoneOf(overall)!].emoji} {overall}٪
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {SALES_AXES.map((axis) => (
        <AxisCard
          key={axis.key}
          axisKey={axis.key}
          icon={axis.icon}
          labelAr={axis.labelAr}
          answers={answers}
          onChoose={choose}
          score={results.find((r) => r.axis === axis.key)?.score ?? null}
        />
      ))}

      <ReportCard results={results} overall={overall} auditHealth={auditHealth} allComplete={allComplete} />
    </div>
  )
}

// ─── تقرير النتيجة — بطاقة أداء المحاور الخمسة (المرحلة ٣) ───────────
function ReportCard({
  results, overall, auditHealth, allComplete,
}: {
  results: AxisResult[]
  overall: number | null
  auditHealth: number | null
  allComplete: boolean
}) {
  const scored = results.filter((r) => r.score != null)
  if (scored.length === 0) return null
  // ترتيب الأولويّة: الأحمر أوّلاً ثم الأصفر (الأدنى درجةً أعلى أولويّة).
  const ranked = [...scored].sort((a, b) => (a.score ?? 100) - (b.score ?? 100))

  return (
    <Card className="overflow-hidden border-2 border-primary/40">
      <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-sky-500" />
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          📊 تقرير تشخيص المبيعات
          {overall != null && zoneOf(overall) && (
            <span className={`rounded-full border px-2.5 py-0.5 text-sm font-bold tabular-nums ${ZONE_META[zoneOf(overall)!].cls}`}>
              الإجمالي {ZONE_META[zoneOf(overall)!].emoji} {overall}٪
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {allComplete ? 'التشخيص مكتمل — مرتّب حسب الأولويّة (الأحمر أوّلاً).' : `أكملت ${scored.length}/${SALES_AXES.length} محاور — أكمل الباقي لتقرير كامل.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ranked.map((r) => (
          <div key={r.axis} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${r.zone ? ZONE_META[r.zone].cls.split(' ')[0] : ''}`}>
            <span className="text-lg" aria-hidden>{r.icon}</span>
            <span className="min-w-[90px] text-sm font-semibold">{r.labelAr}</span>
            {r.zone && (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${ZONE_META[r.zone].cls}`}>
                {ZONE_META[r.zone].emoji} {r.score}٪ · {ZONE_META[r.zone].labelAr}
              </span>
            )}
            {r.solutions.length > 0 && (
              <span className="flex-1 text-xs text-muted-foreground">
                <b className="text-foreground">أولى الخطوات:</b> {r.solutions[0]}
              </span>
            )}
          </div>
        ))}

        {/* مصالحة عرضيّة مع التدقيق — بلا دمج رقمي */}
        {auditHealth != null && (
          <div className="mt-1 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            🔗 للسياق: <b className="text-foreground tabular-nums">تدقيقك العام {Math.round(auditHealth)}٪</b> —
            التشخيص أعلاه يفصّلها على ٥ محاور مبيعات (رقمان مستقلّان، لا يُدمَجان).
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── بطاقة محور — تعرض تسلسل أسئلته التكيّفي ────────────────────────
function AxisCard({
  axisKey, icon, labelAr, answers, onChoose, score,
}: {
  axisKey: SalesAxisKey
  icon: string
  labelAr: string
  answers: DiagAnswers
  onChoose: (qid: string, value: string) => void
  score: number | null
}) {
  const flow = axisFlow(axisKey, answers)
  const zone = zoneOf(score)
  const complete = axisComplete(axisKey, answers)

  return (
    <Card className={`overflow-hidden border-2 ${zone ? ZONE_META[zone].cls.split(' ')[0] : 'border-border'}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span aria-hidden>{icon}</span>
          <span>المحور {labelAr}</span>
          {score != null && zone && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${ZONE_META[zone].cls}`}>
              {ZONE_META[zone].emoji} {score}٪
            </span>
          )}
          {complete && <span className="text-[11px] text-emerald-600">✓ مكتمل</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {flow.map((q, i) => (
          <QuestionBlock
            key={q.id}
            q={q}
            index={i}
            selected={answers[q.id] ?? null}
            onChoose={(v) => onChoose(q.id, v)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function QuestionBlock({
  q, index, selected, onChoose,
}: {
  q: DiagQuestion
  index: number
  selected: string | null
  onChoose: (value: string) => void
}) {
  const chosen = selected ? q.options.find((o) => o.value === selected) : undefined
  return (
    <div className={`rounded-xl border p-3 ${index > 0 ? 'bg-muted/20' : 'bg-card'}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {index > 0 && <span className="text-[10px] text-muted-foreground">↳ عمّق أكثر</span>}
        <span>{q.prompt}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {q.options.map((o) => {
          const active = selected === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChoose(o.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-right text-sm transition ${
                active ? 'border-primary bg-primary/10 font-medium' : 'bg-card hover:border-primary/40 hover:bg-muted/40'
              }`}
            >
              <span className={`grid size-4 shrink-0 place-items-center rounded-full border ${active ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </span>
              <span className="flex-1">{o.label}</span>
            </button>
          )
        })}
      </div>

      {/* التشخيص + الحلّ بعد الاختيار */}
      {chosen && (chosen.hint || chosen.solution) && (
        <div className="mt-2 space-y-1.5">
          {chosen.hint && (
            <div className="rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground">{chosen.hint}</div>
          )}
          {chosen.solution && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-1.5 text-xs text-emerald-900">
              <b>💡 الحلّ:</b> {chosen.solution}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
