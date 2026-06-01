import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import { createKPI, deleteKPI, listKPIs, updateKPI, type KPI } from '@/lib/strategicApi'

const FREQS = [
  ['daily',     'يومي'],
  ['weekly',    'أسبوعي'],
  ['monthly',   'شهري'],
  ['quarterly', 'ربعي'],
  ['annual',    'سنوي'],
] as const

function freqLabel(f: string): string {
  return FREQS.find((x) => x[0] === f)?.[1] ?? f
}

function pct(k: KPI): number {
  if (!k.targetValue) return 0
  return Math.min(150, Math.round((k.currentValue / k.targetValue) * 100))
}

function statusOf(p: number): { label: string; tint: string } {
  if (p >= 95) return { label: 'محقق',      tint: 'border-emerald-300 bg-emerald-50/60' }
  if (p >= 70) return { label: 'في المسار', tint: 'border-sky-300 bg-sky-50/60' }
  if (p >= 40) return { label: 'في خطر',    tint: 'border-amber-300 bg-amber-50/60' }
  return { label: 'متعثر', tint: 'border-rose-300 bg-rose-50/60' }
}

export function KPIsPage() {
  return (
    <StrategicShell
      title="مؤشرات الأداء (KPIs)"
      description="مكتبة المؤشرات مع الأهداف والقيم الحالية. لون كل مؤشر يعكس حالته."
      actions={
        <Link to="/kpi-entries" className={buttonVariants({ variant: 'outline' })}>
          إدخالات تاريخية ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', unit: '%', targetValue: '100', frequency: 'monthly' })

  useEffect(() => {
    listKPIs(companyId).then(setKpis).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const target = Number(form.targetValue)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('قيمة مستهدفة غير صالحة')
      return
    }
    setCreating(true)
    try {
      const k = await createKPI({
        companyId,
        name: form.name,
        unit: form.unit,
        targetValue: target,
        frequency: form.frequency,
      })
      setKpis((p) => [...p, k])
      setForm({ name: '', unit: '%', targetValue: '100', frequency: form.frequency })
      toast.success('تم إنشاء المؤشر')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function updateCurrent(id: string, currentValue: number) {
    try {
      const updated = await updateKPI(id, { currentValue })
      setKpis((p) => p.map((k) => (k.id === id ? { ...k, ...updated } : k)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(k: KPI) {
    if (!confirm(`حذف المؤشر "${k.name}"؟`)) return
    try {
      await deleteKPI(k.id)
      setKpis((p) => p.filter((x) => x.id !== k.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  const stats = kpis.reduce<Record<string, number>>((acc, k) => {
    const s = statusOf(pct(k)).label
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <CardDescription>محقق</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-emerald-700">{stats['محقق'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader>
            <CardDescription>في المسار</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-sky-700">{stats['في المسار'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardDescription>في خطر</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-700">{stats['في خطر'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-rose-200 bg-rose-50/60">
          <CardHeader>
            <CardDescription>متعثر</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-rose-700">{stats['متعثر'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-amber-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>مؤشر جديد</CardTitle>
          <CardDescription>عرّف المؤشر، وحدد قيمة الهدف وتكرار القياس.</CardDescription>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">اسم المؤشر</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="مثال: نسبة الاحتفاظ بالعملاء" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">الوحدة</Label>
              <Input id="unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target">القيمة المستهدفة</Label>
              <Input id="target" type="number" value={form.targetValue} onChange={(e) => setForm((p) => ({ ...p, targetValue: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="freq">التكرار</Label>
              <select
                id="freq"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
              >
                {FREQS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end self-end">
              <Button type="submit" disabled={creating || !form.name.trim()}>
                {creating ? 'جاري الإنشاء…' : '+ إنشاء المؤشر'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => {
          const p = pct(k)
          const s = statusOf(p)
          return (
            <Card key={k.id} className={s.tint}>
              <CardHeader>
                <CardTitle className="text-base">{k.name}</CardTitle>
                <CardDescription>{freqLabel(k.frequency)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{k.currentValue.toLocaleString('ar-SA')}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">/ {k.targetValue.toLocaleString('ar-SA')} {k.unit}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{s.label}</span>
                    <span className="tabular-nums">{p}%</span>
                  </div>
                  <Progress value={Math.min(100, p)} className="h-2" />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 w-28 bg-background tabular-nums"
                    type="number"
                    value={k.currentValue}
                    onChange={(e) => updateCurrent(k.id, Number(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground">قيمة حالية</span>
                  <Button variant="ghost" size="sm" className="mr-auto" onClick={() => remove(k)}>حذف</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {!loading && kpis.length === 0 && (
          <Card className="border-dashed md:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد مؤشرات بعد. أنشئ أول مؤشر من فوق.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
