import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { createKPIEntry, listKPIEntries, listKPIs, type KPI, type KPIEntry } from '@/lib/strategicApi'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
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
        date: new Date(e.enteredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: e.value,
      }))
  }, [entries])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  if (kpis.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>لا توجد مؤشرات بعد</CardTitle>
          <CardDescription>أنشئ مؤشراً واحداً على الأقل في صفحة المؤشرات.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>اختر مؤشراً</CardTitle>
          <CardDescription>{kpis.length} مؤشر متاح.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {kpis.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={selected === k.id ? 'default' : 'outline'}
              onClick={() => setSelected(k.id)}
            >
              {k.name} <span className="ml-1 text-xs tabular-nums opacity-70">{k.currentValue}/{k.targetValue} {k.unit}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {kpi && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-sky-200 bg-sky-50/60">
              <CardHeader>
                <CardDescription>القيمة الحالية</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-sky-700">{kpi.currentValue.toLocaleString('en-US')}</CardTitle>
                <p className="text-xs text-muted-foreground">{kpi.unit}</p>
              </CardHeader>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/60">
              <CardHeader>
                <CardDescription>المستهدف</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-emerald-700">{kpi.targetValue.toLocaleString('en-US')}</CardTitle>
                <p className="text-xs text-muted-foreground">{kpi.unit}</p>
              </CardHeader>
            </Card>
            <Card className="border-violet-200 bg-violet-50/60">
              <CardHeader>
                <CardDescription>عدد الإدخالات</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-violet-700">{entries.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
            <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
            <CardHeader>
              <CardTitle>تسجيل قيمة جديدة</CardTitle>
              <CardDescription>تظهر مباشرة في الجدول والمخطط أدناه.</CardDescription>
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
                        <td className="py-2 tabular-nums font-medium">{e.value.toLocaleString('en-US')} {kpi.unit}</td>
                        <td className="py-2 text-xs text-muted-foreground">{e.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
