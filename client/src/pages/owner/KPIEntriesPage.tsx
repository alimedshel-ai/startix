import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import type { DeptCode } from '@/lib/deptApi'
import { findKPIMeta, IMPORTANCE_META, KPI_CATEGORY_META } from '@/lib/deptKPIs'
import { analyzeGap, expectedValueAt } from '@/lib/sCurve'
import { createKPIEntry, listKPIEntries, listKPIs, type KPI, type KPIEntry } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

// عدد الأيام منذ تاريخ ما (تقريبي).
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// أفق التذكير بحسب تكرار المؤشّر — بعد كم يوم يُعتبَر «متأخّراً».
function overdueThreshold(frequency: string): number {
  switch (frequency) {
    case 'daily':     return 2
    case 'weekly':    return 10
    case 'monthly':   return 35
    case 'quarterly': return 100
    case 'annual':    return 380
    default:          return 35
  }
}

function freqLabelAr(f: string): string {
  return f === 'daily' ? 'يومي' : f === 'weekly' ? 'أسبوعي' : f === 'monthly' ? 'شهري' : f === 'quarterly' ? 'ربعي' : 'سنوي'
}

// ─── حالة المؤشّر — تحدّد لونه وأولويّته ─────────────────────────
type KPIStatus = 'needsFirst' | 'overdue' | 'atRisk' | 'onTrack' | 'achieved'

interface StatusMeta {
  label: string
  emoji: string
  chipClass: string
  borderClass: string
  bgClass: string
  helpAr: string
  priority: number // للترتيب — الأعلى أولاً
}

const STATUS_META: Record<KPIStatus, StatusMeta> = {
  needsFirst: {
    label: 'يحتاج قياس أوّل',
    emoji: '🆕',
    chipClass: 'border-amber-400 bg-amber-100 text-amber-800',
    borderClass: 'border-amber-400',
    bgClass: 'bg-amber-50/60',
    helpAr: 'لم يُسجَّل له أي قيمة بعد — ابدأ بقياس الأساس.',
    priority: 5,
  },
  overdue: {
    label: 'تأخّر قياسه',
    emoji: '⏰',
    chipClass: 'border-orange-400 bg-orange-100 text-orange-800',
    borderClass: 'border-orange-400',
    bgClass: 'bg-orange-50/60',
    helpAr: 'مرّت فترة أطول من المتوقّع دون تسجيل — سجّل قيمة الآن.',
    priority: 4,
  },
  atRisk: {
    label: 'في خطر',
    emoji: '🔴',
    chipClass: 'border-rose-400 bg-rose-100 text-rose-800',
    borderClass: 'border-rose-400',
    bgClass: 'bg-rose-50/60',
    helpAr: 'القيمة الحاليّة أقلّ من ٧٠٪ من المستهدف — يحتاج تدخّلاً.',
    priority: 3,
  },
  onTrack: {
    label: 'على المسار',
    emoji: '🟢',
    chipClass: 'border-sky-400 bg-sky-100 text-sky-800',
    borderClass: 'border-sky-300',
    bgClass: 'bg-sky-50/60',
    helpAr: 'يسير بشكل جيّد — استمرّ في المتابعة الدوريّة.',
    priority: 2,
  },
  achieved: {
    label: 'محقّق',
    emoji: '✅',
    chipClass: 'border-emerald-400 bg-emerald-100 text-emerald-800',
    borderClass: 'border-emerald-300',
    bgClass: 'bg-emerald-50/60',
    helpAr: 'المستهدف تحقّق — يمكنك رفع سقف الطموح.',
    priority: 1,
  },
}

function classifyKPI(k: KPI, entriesCount: number, lastEntryAt: string | null): KPIStatus {
  if (entriesCount === 0) return 'needsFirst'
  const overdue = lastEntryAt && daysSince(lastEntryAt) > overdueThreshold(k.frequency)
  const ratio = k.targetValue > 0 ? k.currentValue / k.targetValue : 0
  if (overdue) return 'overdue'
  if (ratio >= 0.95) return 'achieved'
  if (ratio < 0.7)   return 'atRisk'
  return 'onTrack'
}

export function KPIEntriesPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/measure?tab=entries${q}`} replace />
}

export function KPIEntriesView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

function CrossNavBar({ clientQuery }: { clientQuery: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
      <span className="text-muted-foreground">
        💡 الإدخالات ← تُغذّي الاتجاه والخطة السنويّة.
      </span>
      <div className="flex flex-wrap gap-2">
        <Link to={`/measure?tab=kpis${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          📊 KPIs ←
        </Link>
        <Link to={`/measure?tab=ogsm${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          🧩 OGSM ←
        </Link>
        <Link to={`/measure?tab=annual${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-primary transition hover:bg-primary hover:text-primary-foreground">
          🗓️ الخطة السنويّة ←
        </Link>
      </div>
    </div>
  )
}

interface KPIWithMeta {
  kpi: KPI
  entriesCount: number
  lastEntryValue: number | null
  lastEntryAt: string | null
  status: KPIStatus
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [params] = useSearchParams()
  const client = params.get('client')
  const clientQuery = client ? `&client=${client}` : ''

  const [kpis, setKpis] = useState<KPI[]>([])
  const [entries, setEntries] = useState<KPIEntry[]>([])
  // خرائط لكل KPI: عدد الإدخالات + آخر قيمة + آخر تاريخ.
  const [meta, setMeta] = useState<Record<string, { count: number; lastValue: number | null; lastAt: string | null }>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<KPIStatus | 'all'>('all')

  useEffect(() => {
    listKPIs(companyId).then(async (list) => {
      setKpis(list)
      if (list[0]) setSelected(list[0].id)
      const nextMeta: Record<string, { count: number; lastValue: number | null; lastAt: string | null }> = {}
      await Promise.all(list.map(async (k) => {
        try {
          const es = await listKPIEntries(k.id)
          const sorted = [...es].sort((a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime())
          nextMeta[k.id] = {
            count: es.length,
            lastValue: sorted[0]?.value ?? null,
            lastAt:    sorted[0]?.enteredAt ?? null,
          }
        } catch {
          nextMeta[k.id] = { count: 0, lastValue: null, lastAt: null }
        }
      }))
      setMeta(nextMeta)
    }).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    if (!selected) { setEntries([]); return }
    listKPIEntries(selected).then(setEntries).catch(() => setEntries([]))
  }, [selected])

  // تصنيف كل KPI + ترتيبها بالأولويّة (الأحمر أوّلاً).
  const kpisRanked = useMemo<KPIWithMeta[]>(() => {
    const list = kpis.map((k) => {
      const m = meta[k.id] ?? { count: 0, lastValue: null, lastAt: null }
      const status = classifyKPI(k, m.count, m.lastAt)
      return { kpi: k, entriesCount: m.count, lastEntryValue: m.lastValue, lastEntryAt: m.lastAt, status }
    })
    return list.sort((a, b) => STATUS_META[b.status].priority - STATUS_META[a.status].priority)
  }, [kpis, meta])

  const kpisFiltered = statusFilter === 'all'
    ? kpisRanked
    : kpisRanked.filter((k) => k.status === statusFilter)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const v = Number(value)
    if (!Number.isFinite(v)) { toast.error('قيمة غير صالحة'); return }
    setSubmitting(true)
    try {
      const entry = await createKPIEntry({ kpiId: selected, value: v, notes: notes || undefined })
      setEntries((p) => [entry, ...p])
      setMeta((prev) => ({
        ...prev,
        [selected]: {
          count: (prev[selected]?.count ?? 0) + 1,
          lastValue: v,
          lastAt: entry.enteredAt,
        },
      }))
      const refreshed = await listKPIs(companyId)
      setKpis(refreshed)
      setValue('')
      setNotes('')
      toast.success('✓ تم تسجيل القيمة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التسجيل'))
    } finally {
      setSubmitting(false)
    }
  }

  // تسجيل مباشر بقيمة مُقترحة (بلا فتح الفورم).
  async function quickRecord(kpiId: string, val: number, autoNote: string) {
    setSubmitting(true)
    try {
      const entry = await createKPIEntry({ kpiId, value: val, notes: autoNote })
      setMeta((prev) => ({
        ...prev,
        [kpiId]: { count: (prev[kpiId]?.count ?? 0) + 1, lastValue: val, lastAt: entry.enteredAt },
      }))
      if (kpiId === selected) setEntries((p) => [entry, ...p])
      const refreshed = await listKPIs(companyId)
      setKpis(refreshed)
      toast.success(`✓ سُجّل ${val.toLocaleString('ar-SA')} — «${autoNote}»`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التسجيل'))
    } finally {
      setSubmitting(false)
    }
  }

  const kpi = kpis.find((k) => k.id === selected) ?? null
  const selectedRanked = kpisRanked.find((r) => r.kpi.id === selected) ?? null

  // Phase 1 — بيانات الرسم: خطّ فعلي (actual) + خطّ متوقّع (expected).
  // إن كان للـKPI expectedPath+startedAt، نسحب القيمة المتوقّعة لكل تاريخ إدخال،
  // ونُضيف نقاط شهريّة إضافيّة من المسار المتوقّع بين أوّل إدخال والمستقبل.
  const chartData = useMemo(() => {
    const sortedEntries = [...entries].sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime())
    const hasCurve = kpi?.expectedPath && kpi.expectedPath.length > 0 && kpi.startedAt
    const points: { date: string; actual?: number; expected?: number; ts: number }[] = []

    // ١) نقاط الإدخالات الفعليّة — كل إدخال يحمل actual + expected (إن وُجد المسار).
    for (const e of sortedEntries) {
      const ts = new Date(e.enteredAt).getTime()
      const expected = hasCurve && kpi
        ? expectedValueAt(kpi.expectedPath!, kpi.startedAt!, new Date(e.enteredAt))
        : null
      points.push({
        date: new Date(e.enteredAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
        actual: e.value,
        expected: expected ?? undefined,
        ts,
      })
    }

    // ٢) لو المسار موجود، أضِف نقاط شهريّة من expectedPath لملء الخطّ المتوقّع.
    if (hasCurve && kpi) {
      const start = new Date(kpi.startedAt!).getTime()
      for (const p of kpi.expectedPath!) {
        const ts = start + p.month * 30.44 * 86400000
        // تجنّب التكرار مع نقاط الإدخالات (فارق أقلّ من ٥ أيام).
        if (points.some((x) => Math.abs(x.ts - ts) < 5 * 86400000)) continue
        points.push({
          date: new Date(ts).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
          expected: p.value,
          ts,
        })
      }
      points.sort((a, b) => a.ts - b.ts)
    }

    return points
  }, [entries, kpi])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  if (kpis.length === 0) {
    return (
      <>
        <CrossNavBar clientQuery={clientQuery} />
        <IntroCard />
        <Card className="border-2 border-amber-300 bg-amber-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🔒</div>
              <div>
                <div className="text-sm font-bold text-amber-900">لا يمكن التسجيل قبل إنشاء مؤشرات</div>
                <div className="mt-0.5 text-xs text-amber-800/80">
                  الإدخالات = قيم لمؤشّرات قائمة. أنشئ KPI واحداً على الأقل في تبويب «مؤشّرات الأداء».
                </div>
              </div>
            </div>
            <Link to={`/measure?tab=kpis${clientQuery}`} className={buttonVariants({ variant: 'default' })}>
              📊 افتح KPIs ←
            </Link>
          </CardContent>
        </Card>
      </>
    )
  }

  // إحصاءات إجماليّة.
  const statusCounts = kpisRanked.reduce((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1
    return acc
  }, {} as Record<KPIStatus, number>)
  const totalEntries = Object.values(meta).reduce((s, m) => s + m.count, 0)

  return (
    <>
      <CrossNavBar clientQuery={clientQuery} />
      <IntroCard />

      {/* شريط الحالات — مرشِّح + مُلخّص */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">حالة مؤشّراتك — {kpis.length} مؤشّر · {totalEntries} إدخال</CardTitle>
          <CardDescription>
            التصنيف حسب الأولويّة — الأصفر «يحتاج قياس أوّل» أوّلاً. اضغط شارة لتصفية القائمة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <StatusChip
              label="الكل"
              emoji="📋"
              active={statusFilter === 'all'}
              count={kpis.length}
              onClick={() => setStatusFilter('all')}
              className="border-slate-300 bg-slate-100 text-slate-800"
            />
            {(['needsFirst', 'overdue', 'atRisk', 'onTrack', 'achieved'] as KPIStatus[]).map((s) => {
              const m = STATUS_META[s]
              const count = statusCounts[s] ?? 0
              if (count === 0) return null
              return (
                <StatusChip
                  key={s}
                  label={m.label}
                  emoji={m.emoji}
                  count={count}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  className={m.chipClass}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* قائمة المؤشّرات — بطاقات كبيرة، سهلة الفهم */}
      <div className="grid gap-3 lg:grid-cols-2">
        {kpisFiltered.map((row) => (
          <KPICard
            key={row.kpi.id}
            row={row}
            specialty={specialty}
            selected={selected === row.kpi.id}
            onSelect={() => setSelected(row.kpi.id)}
            onQuickRecord={(v, note) => quickRecord(row.kpi.id, v, note)}
            submitting={submitting}
          />
        ))}
        {kpisFiltered.length === 0 && (
          <Card className="border-dashed lg:col-span-2">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا مؤشّرات في هذه الفئة — جرّب فئة أخرى.
            </CardContent>
          </Card>
        )}
      </div>

      {/* التفاصيل — تسجيل يدوي + رسم + سجل — للـ KPI المحدد */}
      {kpi && selectedRanked && (
        <SelectedKPIDetails
          kpi={kpi}
          ranked={selectedRanked}
          entries={entries}
          chartData={chartData}
          value={value}
          setValue={setValue}
          notes={notes}
          setNotes={setNotes}
          submit={submit}
          submitting={submitting}
          specialty={specialty}
          clientQuery={clientQuery}
        />
      )}

      <NextStepCTA
        totalEntries={totalEntries}
        needsFirstCount={statusCounts.needsFirst ?? 0}
        atRiskCount={statusCounts.atRisk ?? 0}
        clientQuery={clientQuery}
      />
    </>
  )
}

// ─── بطاقة مؤشّر واحد — مع اقتراحات ذكيّة للتسجيل ───────────────
function KPICard({
  row, specialty, selected, onSelect, onQuickRecord, submitting,
}: {
  row: KPIWithMeta
  specialty: DeptCode | null
  selected: boolean
  onSelect: () => void
  onQuickRecord: (value: number, note: string) => void
  submitting: boolean
}) {
  const { kpi, entriesCount, lastEntryValue, lastEntryAt, status } = row
  const sm = STATUS_META[status]
  const meta = findKPIMeta(kpi.name, specialty)
  const catIcon = meta ? KPI_CATEGORY_META[meta.category].icon : '📊'
  const pct = kpi.targetValue > 0 ? Math.round((kpi.currentValue / kpi.targetValue) * 100) : 0

  // ─── اقتراحات القيم ─────────────────────────────────
  // نُقدّم للمدير ٣-٥ خيارات جاهزة للتسجيل بضغطة واحدة:
  //   ١) القيمة الحاليّة (تحديث سريع أو قياس أساس)
  //   ٢) المستهدف (سجّل تحقيقاً)
  //   ٣) آخر قيمة + ١٠٪ (تحسّن تقديري)
  //   ٤) آخر قيمة - ١٠٪ (تراجع)
  //   ٥) ٨٠٪ من المستهدف (نقطة مرجعيّة)
  const suggestions: { value: number; labelAr: string; note: string; tint: string }[] = []
  if (entriesCount === 0 && kpi.currentValue > 0) {
    suggestions.push({
      value: kpi.currentValue,
      labelAr: `القيمة الحاليّة (${kpi.currentValue.toLocaleString('ar-SA')})`,
      note: 'قياس أساس — بدء تتبّع الاتجاه',
      tint: 'border-amber-400 bg-amber-50 text-amber-800',
    })
  }
  if (lastEntryValue != null) {
    suggestions.push({
      value: lastEntryValue,
      labelAr: `تكرار آخر قيمة (${lastEntryValue.toLocaleString('ar-SA')})`,
      note: 'لا تغيير عن القياس السابق',
      tint: 'border-slate-300 bg-slate-50 text-slate-700',
    })
    const up = Math.round(lastEntryValue * 1.1)
    suggestions.push({
      value: up,
      labelAr: `+١٠٪ (${up.toLocaleString('ar-SA')})`,
      note: 'تحسّن تقديري ١٠٪ عن آخر قياس',
      tint: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    })
    const down = Math.round(lastEntryValue * 0.9)
    suggestions.push({
      value: down,
      labelAr: `-١٠٪ (${down.toLocaleString('ar-SA')})`,
      note: 'تراجع تقديري ١٠٪ عن آخر قياس',
      tint: 'border-rose-300 bg-rose-50 text-rose-800',
    })
  }
  if (kpi.targetValue > 0) {
    suggestions.push({
      value: kpi.targetValue,
      labelAr: `المستهدف كاملاً (${kpi.targetValue.toLocaleString('ar-SA')})`,
      note: 'سجّل تحقيق المستهدف',
      tint: 'border-emerald-400 bg-emerald-100 text-emerald-900',
    })
    const eighty = Math.round(kpi.targetValue * 0.8)
    suggestions.push({
      value: eighty,
      labelAr: `٨٠٪ من المستهدف (${eighty.toLocaleString('ar-SA')})`,
      note: 'نقطة مرجعيّة — قريب من المستهدف',
      tint: 'border-sky-300 bg-sky-50 text-sky-800',
    })
  }

  return (
    <Card
      className={`transition ${sm.borderClass} ${sm.bgClass} ${selected ? 'ring-2 ring-primary/50 shadow-md' : 'cursor-pointer hover:shadow'}`}
      onClick={selected ? undefined : onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="text-2xl">{catIcon}</span>
            <div>
              <div className="text-sm font-bold">{kpi.name}</div>
              <div className="text-[11px] text-muted-foreground">
                ⏱️ {freqLabelAr(kpi.frequency)} · {entriesCount} إدخال
                {lastEntryAt && ` · آخر قياس منذ ${daysSince(lastEntryAt)} يوم`}
              </div>
            </div>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${sm.chipClass}`}>
            {sm.emoji} {sm.label}
          </span>
        </div>
        <div className="mt-2 rounded-md border border-dashed bg-white/40 px-2 py-1 text-[10px] text-muted-foreground">
          {sm.helpAr}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* رقم واضح: القيمة الحاليّة → المستهدف */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-white/60 p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">الحاليّة</div>
            <div className="text-lg font-bold tabular-nums">{kpi.currentValue.toLocaleString('ar-SA')}</div>
          </div>
          <div className="rounded-lg border bg-white/60 p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">المستهدف</div>
            <div className="text-lg font-bold tabular-nums">{kpi.targetValue.toLocaleString('ar-SA')}</div>
          </div>
          <div className="rounded-lg border bg-white/60 p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">النسبة</div>
            <div className="text-lg font-bold tabular-nums">{pct}٪</div>
          </div>
        </div>
        <Progress value={Math.min(100, pct)} className="h-2" />

        {/* اقتراحات ذكيّة — قيم جاهزة للتسجيل بضغطة واحدة */}
        {suggestions.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              💡 سجّل بضغطة واحدة — أو اختر «تعبئة يدوية» أدناه:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={submitting}
                  onClick={(e) => {
                    e.stopPropagation()
                    onQuickRecord(sug.value, sug.note)
                  }}
                  className={`rounded-full border px-2 py-1 text-[10px] font-medium transition hover:shadow ${sug.tint} disabled:opacity-50`}
                  title={sug.note}
                >
                  ＋ {sug.labelAr}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* زر «تعبئة يدوية» — يفتح تفاصيل المؤشّر أدناه */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {selected ? '↓ التفاصيل والرسم البياني أدناه' : '✍️ تعبئة يدوية / رؤية التفاصيل ←'}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── تفاصيل المؤشّر المحدد — الفورم اليدوي + الرسم + السجل ──────
function SelectedKPIDetails({
  kpi, ranked, entries, chartData, value, setValue, notes, setNotes, submit, submitting, specialty, clientQuery,
}: {
  kpi: KPI
  ranked: KPIWithMeta
  entries: KPIEntry[]
  chartData: { date: string; actual?: number; expected?: number; ts: number }[]
  value: string
  setValue: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  submit: (e: React.FormEvent) => Promise<void>
  submitting: boolean
  specialty: DeptCode | null
  clientQuery: string
}) {
  const kpiMeta = findKPIMeta(kpi.name, specialty)
  const catMeta = kpiMeta ? KPI_CATEGORY_META[kpiMeta.category] : null
  const impMeta = kpiMeta ? IMPORTANCE_META[kpiMeta.importance] : null

  // ملاحظات جاهزة — يختار المدير أو يعدّل.
  const NOTE_PRESETS = [
    'قياس روتيني',
    'مراجعة شهريّة',
    'بعد اجتماع الفريق',
    'بعد تدخّل تحسيني',
    'قياس ربعي',
    'مراجعة سنويّة',
    'بعد إطلاق مبادرة',
  ]

  return (
    <>
      <Card className="border-2 border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span>🔍</span>
            التفاصيل الكاملة — {kpi.name}
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_META[ranked.status].chipClass}`}>
              {STATUS_META[ranked.status].emoji} {STATUS_META[ranked.status].label}
            </span>
          </CardTitle>
          <CardDescription>
            {STATUS_META[ranked.status].helpAr}
          </CardDescription>
        </CardHeader>
      </Card>

      {kpiMeta && catMeta && impMeta && (
        <Card className={`border-2 ${catMeta.color.replace('text-', 'border-').split(' ')[0]}`}>
          <CardContent className="p-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-2xl">{catMeta.icon}</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-sm font-bold">{kpi.name}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${catMeta.color}`}>{catMeta.labelAr}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${impMeta.color}`}>{impMeta.badge} {impMeta.labelAr}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  <b className="text-foreground">لماذا هذا المؤشّر مهم؟</b> {kpiMeta.why}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🧮 مساعد الحساب — للمؤشّرات التي تحمل howToCalculate */}
      {kpiMeta?.howToCalculate && (
        <Card className="border-2 border-sky-300 bg-gradient-to-l from-sky-50 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-xl">🧮</span>
              كيف أحسب هذا المؤشّر؟ — دليل مبسّط
            </CardTitle>
            <CardDescription>لست بحاجة لأن تكون خبيراً — اتبع الصيغة أو استعمل المثال.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            {/* الصيغة */}
            <div className="rounded-lg border-2 border-sky-200 bg-white p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-sky-700">✏️ الصيغة</div>
              <div className="text-sm font-semibold text-sky-900">{kpiMeta.howToCalculate.formula}</div>
            </div>

            {/* المثال */}
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">💡 مثال حسابي</div>
              <div className="text-sm font-semibold text-emerald-900 tabular-nums">{kpiMeta.howToCalculate.example}</div>
            </div>

            {/* المستويات المرجعيّة */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">📏 المستويات المرجعيّة</div>
              <div className="grid gap-1.5 sm:grid-cols-4">
                {kpiMeta.howToCalculate.benchmarks.map((b, i) => {
                  const colors: Record<string, string> = {
                    'ممتاز': 'border-emerald-400 bg-emerald-50 text-emerald-900',
                    'جيد':   'border-sky-400 bg-sky-50 text-sky-900',
                    'تحذير': 'border-amber-400 bg-amber-50 text-amber-900',
                    'حرج':   'border-rose-400 bg-rose-50 text-rose-900',
                  }
                  const icons: Record<string, string> = {
                    'ممتاز': '🟢', 'جيد': '🔵', 'تحذير': '🟡', 'حرج': '🔴',
                  }
                  return (
                    <div key={i} className={`rounded-md border-2 p-2 text-center ${colors[b.level]}`}>
                      <div className="text-[10px] font-bold">{icons[b.level]} {b.level}</div>
                      <div className="mt-0.5 text-[11px] tabular-nums">{b.range}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* إجراءات التحسين */}
            {kpiMeta.howToCalculate.improveActions && kpiMeta.howToCalculate.improveActions.length > 0 && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">🚀 كيف أحسّنه؟</div>
                <ul className="grid gap-1">
                  {kpiMeta.howToCalculate.improveActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary">{i + 1}.</span>
                      <span className="flex-1 text-[11px] leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* الفورم اليدوي — أوضح، مع ملاحظات جاهزة */}
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle>✍️ تعبئة يدويّة — قيمة مخصّصة</CardTitle>
          <CardDescription>
            استعمل هذا لتسجيل قيمة رقم غير موجود في الأزرار السريعة أعلاه.
          </CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="val">
                  القيمة الجديدة <span className="text-muted-foreground">({kpi.unit})</span>
                </Label>
                <Input
                  id="val"
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`أدخل رقماً — مثلاً ${kpi.currentValue || kpi.targetValue}`}
                  className="text-lg tabular-nums"
                />
                <p className="text-[10px] text-muted-foreground">
                  ⓘ رقم عشري مسموح. أعلى من المستهدف = تجاوز، أقل = دون الهدف.
                </p>
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="notes">ملاحظات (سياق)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: بعد إطلاق حملة تسويقيّة… / تحسّن مقارنةً بالشهر السابق…"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted-foreground">ملاحظات جاهزة:</span>
                  {NOTE_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNotes(notes ? `${notes} · ${n}` : n)}
                      className="rounded-full border bg-card px-2 py-0.5 text-[9px] text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                    >
                      ＋ {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || !value}>
                {submitting ? 'جاري التسجيل…' : '💾 سجّل القيمة'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* التفسير — بعد الفورم */}
      {(() => {
        const trend = analyzeTrend(entries, kpi.targetValue)
        return (
          <Card className={`border ${
            trend.vsTarget === 'onTarget' ? 'border-emerald-300 bg-emerald-50/40' :
            trend.direction === 'down' && trend.vsTarget === 'below' ? 'border-rose-300 bg-rose-50/40' :
            'border-amber-300 bg-amber-50/40'
          }`}>
            <CardContent className="p-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-xl">
                  {trend.vsTarget === 'onTarget' ? '✅' : trend.direction === 'down' && trend.vsTarget === 'below' ? '⚠️' : '💡'}
                </span>
                <div className="flex-1">
                  <div className="font-bold text-foreground">تفسير الاتجاه</div>
                  <div className="mt-0.5 text-muted-foreground">{trend.interpretationAr}</div>
                  {trend.vsTarget === 'below' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link to={`/priority?tab=initiatives${clientQuery}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        💡 راجع المبادرات
                      </Link>
                      <Link to={`/priority?tab=eisenhower${clientQuery}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        🎯 أضِف تدخّلاً
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📈 متوقّع مقابل واقع</CardTitle>
            <CardDescription>
              الخطّ الأزرق = القيم الفعليّة المسجّلة · الخطّ البنفسجي المتقطّع = المسار المتوقّع (منحنى S) · الخطّ الأخضر = المستهدف.
              {kpi.expectedPath && kpi.startedAt && (
                <span className="mr-2 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                  ✨ منحنى مُفعّل
                </span>
              )}
              {(!kpi.expectedPath || !kpi.startedAt) && (
                <span className="mr-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  ⚠️ بلا منحنى متوقّع — أضِف baseline عند الإنشاء
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <ReferenceLine y={kpi.targetValue} stroke="#10b981" strokeDasharray="4 4" label="المستهدف" />
                {kpi.baselineValue != null && (
                  <ReferenceLine y={kpi.baselineValue} stroke="#94a3b8" strokeDasharray="2 4" label="الأساس" />
                )}
                <Line type="monotone" dataKey="expected" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls name="المتوقّع" />
                <Line type="monotone" dataKey="actual" stroke="#0ea5e9" strokeWidth={3} dot connectNulls name="الواقع" />
              </LineChart>
            </ResponsiveContainer>
            {kpi.expectedPath && kpi.startedAt && kpi.baselineValue != null && entries.length > 0 && (
              <GapAnalysisPanel kpi={kpi} lastEntry={entries[0]} />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>📜 السجل التاريخي — {entries.length} إدخال</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد إدخالات — سجّل أوّل قيمة من الأزرار السريعة أعلاه.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-xs text-muted-foreground">
                  <th className="py-2">التاريخ</th>
                  <th className="py-2">القيمة</th>
                  <th className="py-2">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2 tabular-nums text-xs">{fmtDate(e.enteredAt)}</td>
                    <td className="py-2 tabular-nums font-medium">{e.value.toLocaleString('ar-SA')} {kpi.unit}</td>
                    <td className="py-2 text-xs text-muted-foreground">{e.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ─── تحليل الاتجاه — كما كان ───────────────────────────────────
function analyzeTrend(entries: KPIEntry[], target: number): {
  direction: 'up' | 'down' | 'flat'
  labelAr: string
  changePct: number
  vsTarget: 'above' | 'below' | 'onTarget'
  interpretationAr: string
} {
  if (entries.length < 2) return { direction: 'flat', labelAr: 'قياس أوّلي', changePct: 0, vsTarget: 'onTarget', interpretationAr: 'أدخل قيمتَين على الأقلّ لرؤية الاتجاه.' }
  const sorted = [...entries].sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime())
  const first = sorted[Math.max(0, sorted.length - 3)]
  const last = sorted[sorted.length - 1]
  const changePct = first.value > 0 ? ((last.value - first.value) / first.value) * 100 : 0
  const direction: 'up' | 'down' | 'flat' = Math.abs(changePct) < 3 ? 'flat' : changePct > 0 ? 'up' : 'down'
  const vsTarget: 'above' | 'below' | 'onTarget' =
    last.value >= target * 0.95 && last.value <= target * 1.05 ? 'onTarget'
    : last.value >= target ? 'above' : 'below'
  const dirLabel = direction === 'up' ? '⬆️ يرتفع' : direction === 'down' ? '⬇️ ينخفض' : '➡️ ثابت'
  let interpretation = ''
  if (vsTarget === 'onTarget')      interpretation = 'مطابق للمستهدف — حافظ على الإيقاع.'
  else if (vsTarget === 'above')    interpretation = 'فوق المستهدف — راجع طموحك، ربما هدفك متحفّظ.'
  else if (direction === 'up')       interpretation = 'دون المستهدف لكن يتحسّن — استمرّ.'
  else if (direction === 'down')     interpretation = '⚠️ دون المستهدف ويتراجع — تدخّل عاجل.'
  else                               interpretation = 'دون المستهدف وثابت — الأداء لا يتحسّن، غيّر التكتيك.'
  return { direction, labelAr: dirLabel, changePct, vsTarget, interpretationAr: interpretation }
}

function StatusChip({
  label, emoji, count, active, onClick, className,
}: { label: string; emoji: string; count: number; active: boolean; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? `${className} ring-2 ring-primary/40` : className + ' opacity-70 hover:opacity-100'
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
    </button>
  )
}

function NextStepCTA({
  totalEntries, needsFirstCount, atRiskCount, clientQuery,
}: { totalEntries: number; needsFirstCount: number; atRiskCount: number; clientQuery: string }) {
  if (totalEntries === 0) {
    return (
      <Card className="border-2 border-amber-300 bg-amber-50/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-amber-900">⚠️ سجّل قيمة واحدة على الأقل</CardTitle>
            <CardDescription>
              كل الأزرار الخضراء أعلاه تسجّل بضغطة واحدة — جرّب «القيمة الحاليّة» لبدء الاتجاه.
            </CardDescription>
          </div>
          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground opacity-60">
            🗓️ الخطة السنويّة 🔒
          </span>
        </CardHeader>
      </Card>
    )
  }
  if (needsFirstCount > 0) {
    return (
      <Card className="border-2 border-sky-300 bg-sky-50/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-sky-900">📈 تغطية جزئيّة — {needsFirstCount} مؤشّر بلا قياس أوّل</CardTitle>
            <CardDescription>
              يمكنك الانتقال أو إكمال قياس المؤشّرات المتبقيّة بالأزرار السريعة أعلاه.
            </CardDescription>
          </div>
          <Link
            to={`/measure?tab=annual${clientQuery}`}
            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
          >
            🗓️ الخطة السنويّة ←
          </Link>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card className="border-2 border-emerald-300 bg-emerald-50/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base text-emerald-900">
            ✓ كل المؤشّرات مُغطّاة{atRiskCount > 0 && ` — ${atRiskCount} في خطر`}
          </CardTitle>
          <CardDescription>
            {atRiskCount > 0
              ? 'الأحمر يحتاج مبادرات تحسينيّة — راجع «المبادرات» أو تابع في «الخطة السنويّة».'
              : 'انتقل إلى الخطة السنويّة لعرض المؤشّرات مع الأهداف والمشاريع.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/measure?tab=annual${clientQuery}`}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            🗓️ الخطة السنويّة ←
          </Link>
          {atRiskCount > 0 && (
            <Link
              to={`/priority?tab=initiatives${clientQuery}`}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              💡 المبادرات ←
            </Link>
          )}
        </div>
      </CardHeader>
    </Card>
  )
}

// ─── لوحة تحليل الفجوة — Phase 1 ────────────────────────────────
// تظهر تحت الرسم مباشرةً عند وجود منحنى متوقّع + إدخال واحد على الأقل.
// تحسب: القيمة المتوقّعة اليوم، الفجوة، الحالة (متقدّم/على المسار/متأخّر/متعثّر).
function GapAnalysisPanel({ kpi, lastEntry }: { kpi: KPI; lastEntry: KPIEntry }) {
  if (!kpi.expectedPath || !kpi.startedAt || kpi.baselineValue == null) return null
  const expectedNow = expectedValueAt(kpi.expectedPath, kpi.startedAt, new Date(lastEntry.enteredAt))
  if (expectedNow == null) return null
  const gap = analyzeGap(lastEntry.value, expectedNow, kpi.baselineValue, kpi.targetValue)
  const bg = gap.status === 'ahead'
    ? 'border-emerald-300 bg-emerald-50/50'
    : gap.status === 'onTrack'
      ? 'border-sky-300 bg-sky-50/50'
      : gap.status === 'behind'
        ? 'border-amber-300 bg-amber-50/50'
        : 'border-rose-400 bg-rose-50/50'
  return (
    <div className={`mt-3 rounded-lg border-2 p-3 text-xs ${bg}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{gap.labelAr}</span>
        </div>
        <div className="flex gap-3 text-[11px] tabular-nums">
          <span>الفعلي: <b>{gap.actual.toLocaleString('ar-SA')}</b> {kpi.unit}</span>
          <span>·</span>
          <span>المتوقّع: <b>{gap.expected.toLocaleString('ar-SA')}</b> {kpi.unit}</span>
          <span>·</span>
          <span>الفارق: <b>{gap.gap > 0 ? '+' : ''}{gap.gap.toLocaleString('ar-SA')}</b> ({gap.gapPct > 0 ? '+' : ''}{gap.gapPct.toFixed(1)}٪ من مدى التحسين)</span>
        </div>
      </div>
      <p className="mt-1.5 leading-relaxed text-muted-foreground">{gap.interpretationAr}</p>
    </div>
  )
}

function IntroCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardContent className="p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">📈</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-foreground">كيف تعمل هذه الصفحة؟</div>
            <p className="mt-1 text-muted-foreground">
              كل مؤشّر يظهر كبطاقة مُلوّنة حسب حالته. اضغط أي زرّ أخضر لتسجيل قيمة بضغطة واحدة،
              أو اختر «تعبئة يدوية» لكتابة رقم مخصّص مع ملاحظات.
            </p>
            <p className="mt-1 text-muted-foreground">
              <b className="text-foreground">دليل الألوان:</b>{' '}
              🆕 يحتاج قياس أوّل ·{' '}
              ⏰ تأخّر قياسه ·{' '}
              🔴 في خطر ·{' '}
              🟢 على المسار ·{' '}
              ✅ محقّق.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
