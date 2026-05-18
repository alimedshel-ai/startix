import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis,
} from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

type AxisKey = 'fs' | 'ca' | 'es' | 'is'

interface SPACEAxis {
  factors: { label: string; score: number }[] // score 1-6 for FS/IS, -1 to -6 for CA/ES
}

interface SPACEData {
  fs: SPACEAxis // Financial Strength
  ca: SPACEAxis // Competitive Advantage
  es: SPACEAxis // Environmental Stability
  is: SPACEAxis // Industry Strength
}

const DEFAULT_FACTORS: Record<AxisKey, string[]> = {
  fs: ['العائد على الاستثمار', 'الرافعة المالية', 'السيولة', 'التدفق النقدي'],
  ca: ['الحصة السوقية', 'جودة المنتج', 'ولاء العميل', 'التحكم بالموردين'],
  es: ['التغير التقني', 'تقلبات الطلب', 'حواجز الدخول', 'الضغط التنظيمي'],
  is: ['إمكانات النمو', 'إمكانات الربحية', 'الاستقرار المالي للقطاع', 'سهولة الدخول للسوق'],
}

const AXIS_META: Record<AxisKey, { title: string; positive: boolean; range: [number, number]; tint: string; icon: string; description: string }> = {
  fs: { title: 'القوة المالية',         positive: true,  range: [1, 6],   tint: 'border-emerald-300 bg-emerald-50/60', icon: '💰', description: 'إيجابي · 1 إلى 6' },
  is: { title: 'قوة الصناعة',           positive: true,  range: [1, 6],   tint: 'border-sky-300 bg-sky-50/60',         icon: '🏭', description: 'إيجابي · 1 إلى 6' },
  ca: { title: 'الميزة التنافسية',      positive: false, range: [-6, -1], tint: 'border-amber-300 bg-amber-50/60',     icon: '⚔️', description: 'سلبي · -6 إلى -1' },
  es: { title: 'استقرار البيئة',        positive: false, range: [-6, -1], tint: 'border-rose-300 bg-rose-50/60',       icon: '🌍', description: 'سلبي · -6 إلى -1' },
}

function emptyAxis(k: AxisKey, positive: boolean): SPACEAxis {
  return {
    factors: DEFAULT_FACTORS[k].map((label) => ({ label, score: positive ? 4 : -3 })),
  }
}

const EMPTY: SPACEData = {
  fs: emptyAxis('fs', true),
  is: emptyAxis('is', true),
  ca: emptyAxis('ca', false),
  es: emptyAxis('es', false),
}

function avg(axis: SPACEAxis): number {
  if (axis.factors.length === 0) return 0
  return axis.factors.reduce((s, f) => s + f.score, 0) / axis.factors.length
}

function posture(x: number, y: number): { name: string; tint: string; advice: string } {
  if (x >= 0 && y >= 0)  return { name: 'هجومية',  tint: 'bg-emerald-100 text-emerald-900', advice: 'وضع ممتاز للنمو، التوسع، والاستحواذ.' }
  if (x >= 0 && y < 0)   return { name: 'تنافسية', tint: 'bg-amber-100 text-amber-900',     advice: 'قاتل على الحصة السوقية وحسّن الكفاءة.' }
  if (x < 0  && y >= 0)  return { name: 'محافظة',  tint: 'bg-sky-100 text-sky-900',         advice: 'ركّز على المنتجات الحالية والابتعاد عن المخاطر.' }
  return { name: 'دفاعية', tint: 'bg-rose-100 text-rose-900', advice: 'قلّص، خفّض التكاليف، أو تخارج.' }
}

export function SPACEMatrixPage() {
  return (
    <StrategicShell
      title="مصفوفة SPACE"
      description="تحديد الوضع الاستراتيجي عبر 4 محاور: القوة المالية، الميزة التنافسية، استقرار البيئة، قوة الصناعة."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<SPACEData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<SPACEData>(companyId, 'SPACE').then((row) => {
      if (row?.data) {
        setData({
          fs: row.data.fs ?? EMPTY.fs,
          ca: row.data.ca ?? EMPTY.ca,
          es: row.data.es ?? EMPTY.es,
          is: row.data.is ?? EMPTY.is,
        })
      }
    }).catch(() => undefined)
  }, [companyId])

  function update(key: AxisKey, idx: number, score: number) {
    setData((p) => ({
      ...p,
      [key]: {
        factors: p[key].factors.map((f, i) => (i === idx ? { ...f, score } : f)),
      },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'SPACE', data)
      toast.success('تم حفظ مصفوفة SPACE')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // Strategic vector
  const x = useMemo(() => avg(data.is) + avg(data.ca), [data])  // is - |ca| → since ca is negative, is + ca works
  const y = useMemo(() => avg(data.fs) + avg(data.es), [data])  // fs + es (es negative)
  const p = posture(x, y)

  return (
    <>
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-bl from-primary/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
        <CardHeader>
          <CardTitle>الوضع الاستراتيجي</CardTitle>
          <CardDescription>الناتج من تجميع المحاور الأربعة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${p.tint}`}>
            <div>
              <div className="text-xs font-medium uppercase">الموقف</div>
              <div className="text-2xl font-bold">{p.name}</div>
              <p className="mt-1 text-sm">{p.advice}</p>
            </div>
            <div className="text-right text-xs tabular-nums">
              <div>المحور X: {x.toFixed(2)}</div>
              <div>المحور Y: {y.toFixed(2)}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="X" domain={[-6, 6]} ticks={[-6, -3, 0, 3, 6]} />
              <YAxis type="number" dataKey="y" name="Y" domain={[-6, 6]} ticks={[-6, -3, 0, 3, 6]} />
              <ReferenceLine x={0} stroke="hsl(220 5% 40%)" />
              <ReferenceLine y={0} stroke="hsl(220 5% 40%)" />
              <Scatter data={[{ x, y }]} fill="hsl(220 90% 56%)" shape="circle" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {(['fs', 'is', 'ca', 'es'] as AxisKey[]).map((k) => {
          const meta = AXIS_META[k]
          const axis = data[k]
          const a = avg(axis)
          return (
            <Card key={k} className={meta.tint}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{meta.icon}</span>
                  {meta.title}
                  <span className="mr-auto tabular-nums text-sm font-normal">متوسط: {a.toFixed(2)}</span>
                </CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {axis.factors.map((f, idx) => (
                    <li key={idx} className="rounded-lg border bg-card p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span>{f.label}</span>
                        <span className="tabular-nums font-medium">{f.score}</span>
                      </div>
                      <input
                        type="range"
                        min={meta.range[0]}
                        max={meta.range[1]}
                        step={1}
                        value={f.score}
                        onChange={(e) => update(k, idx, Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المصفوفة'}</Button>
      </div>
    </>
  )
}
