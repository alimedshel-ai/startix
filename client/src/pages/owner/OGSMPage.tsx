import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import {
  getArtifact, listInitiatives, listKPIs, listObjectives,
  upsertArtifact,
  type Initiative, type KPI, type Objective,
} from '@/lib/strategicApi'
import { pickStrategicPath, type StrategicPath } from '@/lib/strategicPath'

// ─── OGSM — Objectives / Goals / Strategies / Measures ─────────────
// إطار رباعي: هدف عام → غاية كمّية → استراتيجية للوصول → مقياس متابعة.
// التوليد الذكي يجمع بين ٤ مصادر (Objectives + OKRs + Initiatives + KPIs)
// + أولويّات الخطّة الاستراتيجيّة لبناء صفوف موزونة تلقائياً.

interface OGSMRow {
  id: string
  objective: string
  goal: string
  strategy: string
  measure: string
  // مصدر التوليد — للعرض فقط، لا يُحفظ في القاعدة إن كان undefined.
  source?: 'plan' | 'objective' | 'manual'
}

interface OGSMData {
  rows: OGSMRow[]
}

const EMPTY: OGSMData = { rows: [] }

interface ColMeta {
  key: keyof Omit<OGSMRow, 'id' | 'source'>
  label: string
  icon: string
  hint: string
  tint: string
  border: string
  helpAr: string
}

const COLS: ColMeta[] = [
  { key: 'objective', label: 'الهدف العام (O)', icon: '🎯', hint: 'ماذا نريد؟',            tint: 'bg-emerald-50/60', border: 'border-emerald-300', helpAr: 'قصدك الاستراتيجي بجملة واحدة — «نريد أن…»' },
  { key: 'goal',      label: 'الغاية الكميّة (G)', icon: '📏', hint: 'كم؟ وبأي أفق؟',        tint: 'bg-sky-50/60',      border: 'border-sky-300',      helpAr: 'رقم واضح + تاريخ — «٣٠٪ نمو خلال ١٢ شهراً»' },
  { key: 'strategy',  label: 'الاستراتيجيّة (S)', icon: '🧭', hint: 'كيف نصل؟',              tint: 'bg-amber-50/60',    border: 'border-amber-300',    helpAr: 'الاختيار الاستراتيجي — أين نُركّز الجهد' },
  { key: 'measure',   label: 'المقياس (M)',      icon: '📊', hint: 'كيف نتابع؟',            tint: 'bg-violet-50/60',   border: 'border-violet-300',   helpAr: 'KPI أسبوعي/شهري لمتابعة التقدّم' },
]

export function OGSMPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/measure?tab=ogsm${q}`} replace />
}

export function OGSMView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

// شريط تنقّل — الطريق: BSC ↔ OGSM ↔ الأهداف ↔ KPIs.
function CrossNavBar() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `&client=${client}` : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
      <span className="text-muted-foreground">
        💡 OGSM يربط الأهداف بالمقاييس — يعمل مع Objectives و KPIs و BSC.
      </span>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/measure?tab=objectives${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          🎯 الأهداف ←
        </Link>
        <Link
          to={`/measure?tab=kpis${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          📊 KPIs ←
        </Link>
        <Link
          to={`/measure?tab=bsc${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          ⚖️ BSC ←
        </Link>
      </div>
    </div>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<OGSMData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // مصادر التوليد الذكي — تُقرأ مرّة عند الفتح.
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [overviewClient, setOverviewClient] = useState<OverviewClient | null>(null)

  useEffect(() => {
    setFetchError(null)
    getArtifact<OGSMData>(companyId, 'OGSM').then((row) => {
      if (row?.data?.rows?.length) setData({ rows: row.data.rows })
    }).catch((err) => {
      console.error('[OGSM] getArtifact failed:', err)
      setFetchError(apiErrorMessage(err, 'تعذّر جلب OGSM من الخادم'))
    })
    // قراءة المصادر الأخرى للتوليد — أخطاء صامتة (لا تُعطّل الصفحة).
    listObjectives(companyId).then(setObjectives).catch(() => undefined)
    listKPIs(companyId).then(setKpis).catch(() => undefined)
    listInitiatives(companyId).then(setInitiatives).catch(() => undefined)
    getProOverview()
      .then((res) => setOverviewClient(res.clients.find((c) => c.companyId === companyId) ?? null))
      .catch(() => undefined)
  }, [companyId])

  const recommendedPath = useMemo<StrategicPath | null>(() => {
    if (!overviewClient) return null
    return pickStrategicPath({
      healthPct: overviewClient.healthPct,
      dangerZone: overviewClient.dangerZone,
      hasAnyAudit: overviewClient.hasAnyAudit,
    })
  }, [overviewClient])

  // إجمالي عدد الحقول المُعبَّأة عبر كل الصفوف — لعرض شريط تقدّم.
  const filledStats = useMemo(() => {
    let filled = 0
    const total = data.rows.length * 4
    for (const r of data.rows) {
      for (const c of COLS) if (r[c.key].trim().length > 0) filled++
    }
    return { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 0 }
  }, [data.rows])

  function add() {
    setData((p) => ({
      rows: [...p.rows, { id: crypto.randomUUID(), objective: '', goal: '', strategy: '', measure: '', source: 'manual' }],
    }))
  }
  function update(id: string, patch: Partial<OGSMRow>) {
    setData((p) => ({ rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }
  function remove(id: string) {
    setData((p) => ({ rows: p.rows.filter((r) => r.id !== id) }))
  }
  function clearAll() {
    if (data.rows.length === 0) return
    if (!confirm(`حذف كل الصفوف (${data.rows.length})؟`)) return
    setData(EMPTY)
  }

  async function save() {
    setSaving(true)
    try {
      // نُنظّف حقول `source` قبل الحفظ — بيانات عرض فقط.
      const clean: OGSMData = {
        rows: data.rows.map((r) => ({
          id: r.id, objective: r.objective, goal: r.goal, strategy: r.strategy, measure: r.measure,
        })),
      }
      await upsertArtifact(companyId, 'OGSM', clean)
      toast.success('تم حفظ OGSM')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── التوليد الذكي ────────────────────────────────────────────
  // يبني صفوف OGSM من ٤ مصادر بالترتيب:
  //   ١. Objectives القائمة (مع OKRs → goal، إن وُجدت)
  //   ٢. الخطة الاستراتيجيّة → أولويّاتها = objectives، مبادراتها = strategies
  //   ٣. Initiatives القائمة → strategies للأهداف المطابقة (بالنوع)
  //   ٤. KPIs القائمة → measures للأهداف المطابقة
  // النتيجة: مصفوفة صفوف موزونة — كل هدف يحصل على goal + strategy + measure عند الإمكان.
  async function generateSmart() {
    setGenerating(true)
    try {
      const existingObjectives = new Set(data.rows.map((r) => r.objective.trim()).filter(Boolean))
      const newRows: OGSMRow[] = [...data.rows]

      // ١) صفوف من Objectives القائمة (مع OKRs → goal).
      for (const o of objectives) {
        const title = o.title.trim()
        if (!title || existingObjectives.has(title)) continue
        const okr = o.okrs?.[0]
        const goalText = okr
          ? `${okr.keyResult} — يستهدف ${okr.targetValue}${okr.unit ? ` ${okr.unit}` : ''}${okr.dueDate ? ` بحلول ${new Date(okr.dueDate).toLocaleDateString('ar-SA')}` : ''}`
          : ''
        // إستراتيجيّة مقترحة من المبادرات (أول مبادرة نشطة تطابق نوع الهدف).
        const relatedInit = initiatives.find((i) => i.status !== 'done' && i.status !== 'cancelled' && (i.description ?? '').includes(title))
          ?? initiatives.find((i) => i.status !== 'done' && i.status !== 'cancelled')
        const strategyText = relatedInit ? relatedInit.title : ''
        // مقياس مقترح من KPIs (أول KPI يوصف بنوع الهدف).
        const relatedKpi = pickKpiForObjectiveType(kpis, o.type)
        const measureText = relatedKpi
          ? `${relatedKpi.name}${relatedKpi.targetValue ? ` (هدف ${relatedKpi.targetValue}${relatedKpi.unit ? ` ${relatedKpi.unit}` : ''})` : ''}`
          : ''
        newRows.push({
          id: crypto.randomUUID(),
          objective: title,
          goal: goalText,
          strategy: strategyText,
          measure: measureText,
          source: 'objective',
        })
        existingObjectives.add(title)
      }

      // ٢) صفوف من الخطة الاستراتيجيّة — لأولويّات ليست ضمن Objectives.
      if (recommendedPath && recommendedPath.key !== 'DEFAULT') {
        for (let i = 0; i < recommendedPath.priorities.length; i++) {
          const priority = recommendedPath.priorities[i].trim()
          if (!priority || existingObjectives.has(priority)) continue
          const strategyLine = recommendedPath.initiatives[i] ?? recommendedPath.initiatives[0] ?? ''
          const measureLine = recommendedPath.suggestedKPIs[i] ?? recommendedPath.suggestedKPIs[0] ?? ''
          newRows.push({
            id: crypto.randomUUID(),
            objective: priority,
            goal: `خلال ${recommendedPath.duration} — ضمن «${recommendedPath.shortName}»`,
            strategy: strategyLine,
            measure: measureLine,
            source: 'plan',
          })
          existingObjectives.add(priority)
        }
      }

      const addedCount = newRows.length - data.rows.length
      if (addedCount === 0) {
        toast.error('لا مصادر جديدة — كل الأهداف والأولويّات موجودة سابقاً.')
      } else {
        setData({ rows: newRows })
        toast.success(`✨ توليد ذكي: ${addedCount} صف — من ${objectives.length} هدف + ${initiatives.length} مبادرة + ${kpis.length} KPI${recommendedPath ? ` + خطة «${recommendedPath.shortName}»` : ''}.`)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد الذكي'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      {fetchError && (
        <Card className="border-rose-300 bg-rose-50/60">
          <CardHeader>
            <CardTitle className="text-rose-900">⚠️ تعذّر جلب OGSM</CardTitle>
            <CardDescription className="text-rose-800">
              {fetchError} — companyId: <code className="rounded bg-white/70 px-1.5 py-0.5 text-[11px]">{companyId}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            راجع Developer Console (F12) وطلب <code>GET /api/strategic/artifacts/{companyId}/OGSM</code>.
          </CardContent>
        </Card>
      )}

      <CrossNavBar />

      {/* 🧠 توليد ذكي */}
      <Card className="border-2 border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد ذكي من بياناتك</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                يجمع {objectives.length} هدف + {initiatives.length} مبادرة + {kpis.length} KPI
                {recommendedPath && recommendedPath.key !== 'DEFAULT' && ` + أولويّات خطة «${recommendedPath.shortName}»`}
                {' '}→ صفوف OGSM موزونة تلقائياً.
              </div>
            </div>
          </div>
          <Button onClick={generateSmart} disabled={generating || saving} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* رأس الأعمدة — تعليمي */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">O · G · S · M — الأعمدة الأربعة</CardTitle>
              <CardDescription>كل صف يمثّل هدفاً واحداً موصولاً بغاية ومقياس واستراتيجيّة.</CardDescription>
            </div>
            {data.rows.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">اكتمال الحقول</span>
                <div className="w-32">
                  <Progress value={filledStats.pct} className="h-1.5" />
                </div>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {filledStats.filled}/{filledStats.total} ({filledStats.pct}٪)
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            {COLS.map((c) => (
              <div key={c.key} className={`rounded-xl border p-3 ${c.tint} ${c.border}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-base">{c.icon}</span>
                  {c.label}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{c.hint}</p>
                <p className="mt-1 rounded-md border border-dashed bg-white/60 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  {c.helpAr}
                </p>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* الصفوف */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">الصفوف — {data.rows.length}</CardTitle>
            <CardDescription>
              {data.rows.length === 0
                ? 'ابدأ بالتوليد الذكي، أو أضِف صفّاً يدوياً.'
                : 'حرّر أي خليّة مباشرةً. الحفظ يُطبَّق على الصفوف كلها.'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {data.rows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-destructive">
                🗑️ تفريغ
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={add}>+ صف جديد</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.rows.map((r, i) => (
              <div key={r.id} className={`rounded-xl border-2 bg-card p-3 ${sourceBorderClass(r.source)}`}>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">الصف {i + 1}</span>
                    {r.source === 'plan' && (
                      <span className="rounded-full border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700">
                        🗺️ من الخطة
                      </span>
                    )}
                    {r.source === 'objective' && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                        🎯 من الأهداف
                      </span>
                    )}
                  </div>
                  <button onClick={() => remove(r.id)} className="hover:text-destructive">حذف</button>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {COLS.map((c) => (
                    <div key={c.key}>
                      <div className={`mb-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${c.tint}`}>
                        {c.icon} {c.label}
                      </div>
                      <Textarea
                        rows={3}
                        value={r[c.key]}
                        onChange={(e) => update(r.id, { [c.key]: e.target.value } as Partial<OGSMRow>)}
                        placeholder={c.helpAr}
                        className={`${r[c.key].trim() ? '' : 'bg-muted/30'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.rows.length === 0 && (
              <div className="rounded-xl border-2 border-dashed bg-muted/20 p-8 text-center">
                <div className="text-4xl">🧩</div>
                <p className="mt-2 text-sm font-medium">لا صفوف بعد</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ابدأ بالضغط على «✨ ولّد الآن» في الأعلى لبناء إطارك من بياناتك،
                  أو أضِف صفّاً يدوياً.
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button onClick={save} disabled={saving || data.rows.length === 0}>
              {saving ? 'جاري الحفظ…' : '💾 حفظ OGSM'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CTA الخطوة التاليّة */}
      {data.rows.length > 0 && <NextStepCTA />}
    </>
  )
}

// حدود ملوّنة بحسب مصدر الصف — عرض بصري فقط.
function sourceBorderClass(source: OGSMRow['source']): string {
  if (source === 'plan')      return 'border-indigo-200'
  if (source === 'objective') return 'border-emerald-200'
  return 'border-transparent'
}

// اختيار KPI مناسب لنوع الـObjective — heuristic بسيط بالكلمات.
function pickKpiForObjectiveType(kpis: KPI[], objType: string): KPI | undefined {
  if (kpis.length === 0) return undefined
  const rules: Record<string, RegExp> = {
    financial: /مالي|ربح|إيراد|هامش|تكلفة|SAR|ريال|ROI/,
    customer:  /عميل|CSAT|NPS|رضا|احتفاظ/,
    people:    /تدريب|فريق|كفاءات|رضا الموظّف|دوران/,
    innovation:/ابتكار|بحث|تطوير|جديد/,
    operations:/إنتاجيّة|كفاءة|وقت|جودة|OEE/,
  }
  const rx = rules[objType]
  if (rx) {
    const match = kpis.find((k) => rx.test(k.name))
    if (match) return match
  }
  return kpis[0]
}

function NextStepCTA() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `&client=${client}` : ''
  return (
    <Card className="border-2 border-emerald-300 bg-emerald-50/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base text-emerald-900">✓ الخطوة التاليّة</CardTitle>
          <CardDescription>
            صفوفك جاهزة. الآن انتقل إلى KPIs لضبط أهداف رقميّة لكل مقياس،
            أو راجع «الأهداف الاستراتيجيّة».
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/measure?tab=kpis${qs}`}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            📊 KPIs ←
          </Link>
          <Link
            to={`/measure?tab=objectives${qs}`}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            🎯 الأهداف ←
          </Link>
        </div>
      </CardHeader>
    </Card>
  )
}
