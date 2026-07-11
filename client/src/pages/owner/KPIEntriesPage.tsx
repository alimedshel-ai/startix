import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { findKPIMeta, IMPORTANCE_META, KPI_CATEGORY_META } from '@/lib/deptKPIs'
import { createKPIEntry, listKPIEntries, listKPIs, type KPI, type KPIEntry } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── تحليل الاتجاه من ٣ إدخالات أخيرة ──────────────────────────
function analyzeTrend(entries: KPIEntry[], target: number): {
  direction: 'up' | 'down' | 'flat'
  labelAr: string
  changePct: number   // نسبة التغيّر من الإدخال الأقدم إلى الأحدث
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

export function KPIEntriesPage() {
  return (
    <StrategicShell
      title="إدخالات المؤشرات"
      description="سجّل قيم المؤشرات الدورية لرسم اتجاهها عبر الوقت."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [kpis, setKpis] = useState<KPI[]>([])
  const [entries, setEntries] = useState<KPIEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listKPIs(companyId).then((list) => {
      setKpis(list)
      if (list[0]) setSelected(list[0].id)
    }).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    if (!selected) {
      setEntries([])
      return
    }
    listKPIEntries(selected).then(setEntries).catch(() => setEntries([]))
  }, [selected])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const v = Number(value)
    if (!Number.isFinite(v)) {
      toast.error('قيمة غير صالحة')
      return
    }
    setSubmitting(true)
    try {
      const entry = await createKPIEntry({ kpiId: selected, value: v, notes: notes || undefined })
      setEntries((p) => [entry, ...p])
      // Refresh KPIs so the current value reflects the new entry
      const refreshed = await listKPIs(companyId)
      setKpis(refreshed)
      setValue('')
      setNotes('')
      toast.success('تم تسجيل القيمة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التسجيل'))
    } finally {
      setSubmitting(false)
    }
  }

  const kpi = kpis.find((k) => k.id === selected) ?? null

  const chartData = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime())
      .map((e) => ({
        date: new Date(e.enteredAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
        value: e.value,
      }))
  }, [entries])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  if (kpis.length === 0) {
    return (
      <>
        <IntroCard />
        <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">📊</div>
              <div>
                <div className="text-sm font-bold text-amber-900">لا مؤشرات بعد</div>
                <div className="mt-0.5 text-xs text-amber-800/80">
                  أنشئ مؤشرات في صفحة KPIs أوّلاً — ثم عد لتسجيل قيمها الدوريّة هنا.
                </div>
              </div>
            </div>
            <Link to="/kpis" className={buttonVariants({ variant: 'default' })}>
              افتح KPIs ←
            </Link>
          </CardContent>
        </Card>
      </>
    )
  }

  // إحصاءات سريعة على مستوى كل المؤشرات
  const trends = kpis.map((k) => {
    return { kpiId: k.id, name: k.name, currentValue: k.currentValue, targetValue: k.targetValue, unit: k.unit }
  })
  const healthy = trends.filter((t) => t.targetValue > 0 && t.currentValue >= t.targetValue * 0.95).length
  const atRisk = trends.filter((t) => t.targetValue > 0 && t.currentValue < t.targetValue * 0.7).length

  return (
    <>
      <IntroCard />

      {/* شارة السياق */}
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              📊 {kpis.length} مؤشر · <b className="text-emerald-700">{healthy}</b> مطابقة · <b className="text-rose-700">{atRisk}</b> في خطر
            </span>
            <span className="text-muted-foreground">
              اختر مؤشراً لرؤية اتجاهه + تفسير مع اقتراحات.
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">اختر مؤشراً</CardTitle>
          <CardDescription>{kpis.length} مؤشر — يظهر معه اتجاهه وتفسيره أدناه.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {kpis.map((k) => {
            const meta = findKPIMeta(k.name, specialty)
            const catIcon = meta ? KPI_CATEGORY_META[meta.category].icon : '📊'
            const pct = k.targetValue > 0 ? Math.round((k.currentValue / k.targetValue) * 100) : 0
            return (
              <Button
                key={k.id}
                size="sm"
                variant={selected === k.id ? 'default' : 'outline'}
                onClick={() => setSelected(k.id)}
                className="gap-1"
              >
                <span>{catIcon}</span>
                {k.name}
                <span className="text-[10px] tabular-nums opacity-70">
                  {k.currentValue}/{k.targetValue} ({pct}٪)
                </span>
              </Button>
            )
          })}
        </CardContent>
      </Card>

      {kpi && (() => {
        const meta = findKPIMeta(kpi.name, specialty)
        const catMeta = meta ? KPI_CATEGORY_META[meta.category] : null
        const impMeta = meta ? IMPORTANCE_META[meta.importance] : null
        const trend = analyzeTrend(entries, kpi.targetValue)
        return (
        <>
          {/* بطاقة «لماذا هذا المؤشر مهم؟» */}
          {meta && catMeta && impMeta && (
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
                      <b className="text-foreground">لماذا؟</b> {meta.why}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="border-sky-200 bg-sky-50/60">
              <CardHeader>
                <CardDescription>القيمة الحالية</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-sky-700">{kpi.currentValue.toLocaleString('ar-SA')}</CardTitle>
                <p className="text-xs text-muted-foreground">{kpi.unit}</p>
              </CardHeader>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/60">
              <CardHeader>
                <CardDescription>المستهدف</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-emerald-700">{kpi.targetValue.toLocaleString('ar-SA')}</CardTitle>
                <p className="text-xs text-muted-foreground">{kpi.unit}</p>
              </CardHeader>
            </Card>
            <Card className={`border-2 ${
              trend.direction === 'up' ? 'border-emerald-400 bg-emerald-50/60' :
              trend.direction === 'down' ? 'border-rose-400 bg-rose-50/60' :
              'border-slate-300 bg-slate-50/60'
            }`}>
              <CardHeader>
                <CardDescription>الاتجاه</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{trend.labelAr}</CardTitle>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {entries.length >= 2 ? `${trend.changePct > 0 ? '+' : ''}${trend.changePct.toFixed(1)}٪` : '—'}
                </p>
              </CardHeader>
            </Card>
            <Card className="border-violet-200 bg-violet-50/60">
              <CardHeader>
                <CardDescription>الإدخالات</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-violet-700">{entries.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* 💡 تفسير الاتجاه — سبب + اقتراح خطوة */}
          <Card className={`border ${
            trend.vsTarget === 'onTarget' ? 'border-emerald-300 bg-emerald-50/40' :
            trend.direction === 'down' && trend.vsTarget === 'below' ? 'border-rose-300 bg-rose-50/40' :
            'border-amber-300 bg-amber-50/40'
          }`}>
            <CardContent className="p-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-xl">
                  {trend.vsTarget === 'onTarget' ? '✅' :
                    trend.direction === 'down' && trend.vsTarget === 'below' ? '⚠️' :
                    '💡'}
                </span>
                <div className="flex-1">
                  <div className="font-bold text-foreground">تفسير الوضع الحالي</div>
                  <div className="mt-0.5 text-muted-foreground">{trend.interpretationAr}</div>
                  {trend.vsTarget === 'below' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link to="/initiatives" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        💡 راجع المبادرات المرتبطة
                      </Link>
                      <Link to="/eisenhower" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        🎯 أدخل تدخّلاً في أيزنهاور
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
            <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
            <CardHeader>
              <CardTitle>تسجيل قيمة جديدة</CardTitle>
              <CardDescription>
                {entries.length > 0
                  ? `آخر قيمة مسجّلة: ${entries[0].value.toLocaleString('ar-SA')} ${kpi.unit} — سجّل قيمة أحدث.`
                  : 'ابدأ بإدخال أول قيمة — كلما زاد عدد الإدخالات، صار الاتجاه أوضح.'}
              </CardDescription>
            </CardHeader>
            <form onSubmit={submit}>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="val">القيمة</Label>
                  <Input id="val" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kpi.unit} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="سبب أو سياق…" />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <Button type="submit" disabled={submitting || !value}>{submitting ? 'جاري التسجيل…' : 'تسجيل'}</Button>
                </div>
              </CardContent>
            </form>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>الاتجاه</CardTitle>
                <CardDescription>القيم المسجلة مرتبة زمنياً، مع خط المستهدف.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <ReferenceLine y={kpi.targetValue} stroke="#10b981" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>السجل التاريخي</CardTitle>
              <CardDescription>{entries.length} إدخال.</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">لا توجد إدخالات بعد.</p>
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

          {/* 🎯 الخطوة التالية */}
          <Card className="border-emerald-300 bg-emerald-50/40">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🗓️</div>
                <div>
                  <div className="text-sm font-bold text-emerald-900">الخطوة التالية: راجع الأداء بمراجعة دوريّة</div>
                  <div className="text-xs text-emerald-800/80">
                    الإدخال المنتظم يبني الاتجاه — راجع كل الأرقام في اللوحة الاستراتيجية.
                  </div>
                </div>
              </div>
              <Link to="/annual-plan" className={buttonVariants({ variant: 'default' })}>
                افتح الخطة السنوية ←
              </Link>
            </CardContent>
          </Card>
        </>
        )
      })()}
    </>
  )
}

// ─── بطاقة تعريف — ما فائدة تسجيل قيم KPI ─────────────────────
function IntroCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardContent className="p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">📈</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-foreground">ما فائدة تسجيل قيم المؤشرات؟</div>
            <p className="mt-1 text-muted-foreground">
              المؤشر مع رقم واحد يخبرك <b className="text-foreground">أين أنت الآن</b>. المؤشر مع سجلّ زمني يخبرك
              <b className="text-foreground"> هل تتحسّن أم تتراجع</b> — وهذا الأهمّ. الاتجاه (⬆️ / ⬇️ / ➡️)
              يكشف ما لا يظهر في الرقم اللحظي.
            </p>
            <p className="mt-1 text-muted-foreground">
              <b className="text-foreground">القاعدة:</b> سجّل قيمة كل فترة (يومي/أسبوعي/شهري بحسب تكرار المؤشر) — نُحلّل الاتجاه ونقترح خطوة.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
