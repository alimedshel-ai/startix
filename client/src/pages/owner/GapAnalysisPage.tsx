import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Dimension {
  id: string
  name: string
  current: number   // 0-100
  desired: number   // 0-100
}

interface GapData {
  dimensions: Dimension[]
}

const EMPTY: GapData = { dimensions: [] }

const DEFAULT_DIMS = [
  'الحوكمة',
  'المالية',
  'الفريق',
  'الرقمي',
  'العمليات',
  'التسويق',
]

function gapPct(d: Dimension): number {
  return Math.max(0, d.desired - d.current)
}

function gapTint(gap: number): string {
  if (gap >= 50) return 'border-rose-300 bg-rose-50/60'
  if (gap >= 30) return 'border-orange-300 bg-orange-50/60'
  if (gap >= 15) return 'border-amber-300 bg-amber-50/60'
  return 'border-emerald-300 bg-emerald-50/60'
}

function gapLabel(gap: number): string {
  if (gap >= 50) return 'فجوة كبيرة جداً'
  if (gap >= 30) return 'فجوة كبيرة'
  if (gap >= 15) return 'فجوة متوسطة'
  if (gap > 0) return 'فجوة صغيرة'
  return 'لا توجد فجوة'
}

export function GapAnalysisPage() {
  return (
    <StrategicShell
      title="تحليل الفجوة"
      description="قارن وضعك الحالي بالمستهدف لكل بُعد، وحدد الفجوات الأكثر أهمية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<GapData>(EMPTY)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getArtifact<GapData>(companyId, 'GAP_ANALYSIS').then((row) => {
      if (row?.data?.dimensions?.length) setData({ dimensions: row.data.dimensions })
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [companyId])

  // If empty after load, seed with default dimensions
  useEffect(() => {
    if (loaded && data.dimensions.length === 0) {
      setData({
        dimensions: DEFAULT_DIMS.map((name) => ({
          id: crypto.randomUUID(),
          name,
          current: 40,
          desired: 80,
        })),
      })
    }
  }, [loaded, data.dimensions.length])

  function add() {
    const name = newName.trim()
    if (!name) return
    setData((p) => ({
      dimensions: [...p.dimensions, { id: crypto.randomUUID(), name, current: 40, desired: 80 }],
    }))
    setNewName('')
  }
  function update(id: string, patch: Partial<Dimension>) {
    setData((p) => ({ dimensions: p.dimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
  }
  function remove(id: string) {
    setData((p) => ({ dimensions: p.dimensions.filter((d) => d.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'GAP_ANALYSIS', data)
      toast.success('تم حفظ تحليل الفجوة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const ranked = [...data.dimensions].sort((a, b) => gapPct(b) - gapPct(a))
  const avgGap = data.dimensions.length === 0 ? 0 : Math.round(data.dimensions.reduce((s, d) => s + gapPct(d), 0) / data.dimensions.length)

  return (
    <>
      <Card className="overflow-hidden border-rose-200 bg-gradient-to-bl from-rose-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
        <CardHeader>
          <CardTitle>متوسط الفجوة</CardTitle>
          <CardDescription>متوسط الفرق بين الحالة المستهدفة والحالية عبر كل الأبعاد.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tabular-nums text-rose-700">{avgGap}%</div>
          <Progress value={avgGap} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأبعاد</CardTitle>
          <CardDescription>{data.dimensions.length} بُعد.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="اسم البُعد (مثال: الابتكار)…"
            />
            <Button variant="outline" onClick={add}>+ بُعد</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {data.dimensions.map((d) => {
              const gap = gapPct(d)
              return (
                <div key={d.id} className={`rounded-xl border p-3 ${gapTint(gap)}`}>
                  <div className="flex items-center gap-2">
                    <Input
                      className="bg-background"
                      value={d.name}
                      onChange={(e) => update(d.id, { name: e.target.value })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>×</Button>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>الحالي</span>
                        <span className="tabular-nums">{d.current}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={d.current}
                        onChange={(e) => update(d.id, { current: Number(e.target.value) })}
                        className="w-full accent-rose-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>المستهدف</span>
                        <span className="tabular-nums">{d.desired}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={d.desired}
                        onChange={(e) => update(d.id, { desired: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-xs font-medium">{gapLabel(gap)}</span>
                      <span className="tabular-nums text-lg font-bold">{gap}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أولوية الفجوات</CardTitle>
          <CardDescription>الأبعاد مرتبة من أكبر فجوة لأصغرها — ابدأ من الأعلى.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {ranked.map((d, i) => {
              const gap = gapPct(d)
              return (
                <li key={d.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                    <span className="font-medium">{d.name || '—'}</span>
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs ${gapTint(gap).replace('/60', '/80')}`}>
                    فجوة {gap}%
                  </span>
                </li>
              )
            })}
            {ranked.length === 0 && <li className="text-sm text-muted-foreground">لا توجد أبعاد بعد.</li>}
          </ol>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ التحليل'}</Button>
      </div>
    </>
  )
}
