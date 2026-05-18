import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Product {
  id: string
  name: string
  marketShare: number   // 0-100 (relative to leader)
  marketGrowth: number  // 0-100 (annual %)
  revenue: number       // SAR
}

interface BCGData {
  products: Product[]
}

const EMPTY: BCGData = { products: [] }

function classify(p: Product): { label: string; color: string; tint: string } {
  const highGrowth = p.marketGrowth >= 50
  const highShare  = p.marketShare >= 50
  if (highGrowth && highShare)  return { label: 'نجوم',         color: '#f59e0b', tint: 'bg-amber-100 text-amber-900' }
  if (highGrowth && !highShare) return { label: 'علامات استفهام', color: '#8b5cf6', tint: 'bg-violet-100 text-violet-900' }
  if (!highGrowth && highShare) return { label: 'بقرات حلوب',    color: '#10b981', tint: 'bg-emerald-100 text-emerald-900' }
  return { label: 'كلاب',                                       color: '#64748b', tint: 'bg-slate-100 text-slate-700' }
}

export function BCGMatrixPage() {
  return (
    <StrategicShell
      title="مصفوفة BCG"
      description="نجوم / بقرات حلوب / علامات استفهام / كلاب — صنّف منتجاتك حسب الحصة السوقية ومعدل نمو السوق."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<BCGData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BCGData>(companyId, 'BCG').then((row) => {
      if (row?.data?.products) setData({ products: row.data.products })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    setData((p) => ({
      products: [
        ...p.products,
        { id: crypto.randomUUID(), name: '', marketShare: 30, marketGrowth: 30, revenue: 100_000 },
      ],
    }))
  }
  function update(id: string, patch: Partial<Product>) {
    setData((p) => ({ products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }
  function remove(id: string) {
    setData((p) => ({ products: p.products.filter((x) => x.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'BCG', data)
      toast.success('تم حفظ BCG')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const scatter = data.products
    .filter((p) => p.name.trim())
    .map((p) => ({
      name: p.name,
      x: p.marketShare,
      y: p.marketGrowth,
      z: Math.max(50, Math.sqrt(p.revenue) * 2),
      fill: classify(p).color,
    }))

  // Counts per quadrant
  const counts = data.products.reduce<Record<string, number>>((acc, p) => {
    const c = classify(p).label
    acc[c] = (acc[c] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardDescription>نجوم</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-700">{counts['نجوم'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <CardDescription>بقرات حلوب</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-emerald-700">{counts['بقرات حلوب'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-violet-200 bg-violet-50/60">
          <CardHeader>
            <CardDescription>علامات استفهام</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-violet-700">{counts['علامات استفهام'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 bg-slate-50/60">
          <CardHeader>
            <CardDescription>كلاب</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-slate-700">{counts['كلاب'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المخطط الفقاعي</CardTitle>
          <CardDescription>حجم الفقاعة = الإيراد. المحور X = الحصة السوقية. المحور Y = نمو السوق.</CardDescription>
        </CardHeader>
        <CardContent>
          {scatter.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              أضف منتجاً وأعطه اسماً لظهوره هنا.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="حصة سوقية" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} reversed />
                <YAxis type="number" dataKey="y" name="نمو السوق" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                <ZAxis type="number" dataKey="z" range={[60, 400]} />
                <ReferenceLine x={50} stroke="hsl(220 5% 60%)" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="hsl(220 5% 60%)" strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as typeof scatter[number]
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-muted-foreground">حصة: {d.x}% · نمو: {d.y}%</div>
                      </div>
                    )
                  }}
                />
                <Scatter data={scatter} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المنتجات</CardTitle>
          <CardDescription>{data.products.length} منتج.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.products.map((p) => {
            const c = classify(p)
            return (
              <div key={p.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[180px] flex-1"
                    value={p.name}
                    onChange={(e) => update(p.id, { name: e.target.value })}
                    placeholder="اسم المنتج…"
                  />
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${c.tint}`}>{c.label}</span>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>×</Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <SliderField label="حصة سوقية %" value={p.marketShare} onChange={(v) => update(p.id, { marketShare: v })} />
                  <SliderField label="نمو السوق %" value={p.marketGrowth} onChange={(v) => update(p.id, { marketGrowth: v })} />
                  <div className="text-xs">
                    <div className="mb-1 text-muted-foreground">الإيراد (SAR)</div>
                    <Input
                      type="number"
                      value={p.revenue}
                      onChange={(e) => update(p.id, { revenue: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            )
          })}
          <div className="flex justify-between pt-1">
            <Button variant="outline" size="sm" onClick={add}>+ منتج جديد</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-xs">
      <div className="mb-1 flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}
