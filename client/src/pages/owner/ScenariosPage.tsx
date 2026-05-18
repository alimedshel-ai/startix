import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { createScenario, deleteScenario, listScenarios, type Scenario, type ScenarioProjection } from '@/lib/strategicApi'

const PRESETS = [
  { name: 'متفائل', color: '#10b981', accent: 'border-emerald-300 bg-emerald-50/60' },
  { name: 'محايد',  color: '#0ea5e9', accent: 'border-sky-300 bg-sky-50/60' },
  { name: 'متشائم', color: '#f43f5e', accent: 'border-rose-300 bg-rose-50/60' },
]

const COLORS = ['#10b981', '#0ea5e9', '#f43f5e', '#8b5cf6', '#f59e0b']

export function ScenariosPage() {
  return (
    <StrategicShell
      title="السيناريوهات"
      description="ابنِ 3 سيناريوهات (متفائل / محايد / متشائم) لمقارنة الإسقاطات المالية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listScenarios(companyId).then(setScenarios).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  async function addPreset(name: string) {
    try {
      const baseYear = new Date().getFullYear()
      const projections: ScenarioProjection[] = Array.from({ length: 3 }, (_, i) => ({
        year: baseYear + i,
        revenue: name === 'متفائل' ? 5_000_000 * (i + 1) : name === 'محايد' ? 3_000_000 * (i + 1) : 1_500_000 * (i + 1),
        profit:  name === 'متفائل' ?   750_000 * (i + 1) : name === 'محايد' ?   300_000 * (i + 1) :    50_000 * (i + 1),
      }))
      const s = await createScenario({
        companyId,
        name,
        assumptions: ['نمو السوق', 'استقرار العملة'],
        projections,
      })
      setScenarios((p) => [...p, s])
      toast.success(`تم إنشاء سيناريو ${name}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    }
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا السيناريو؟')) return
    try {
      await deleteScenario(id)
      setScenarios((p) => p.filter((s) => s.id !== id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // Merge all projections into a single chart series by year
  const chartData = useMemo(() => {
    const byYear = new Map<number, Record<string, number>>()
    scenarios.forEach((s) => {
      s.projections.forEach((p) => {
        const row = byYear.get(p.year) ?? { year: p.year }
        row[s.name] = p.revenue
        byYear.set(p.year, row)
      })
    })
    return [...byYear.entries()].map(([, v]) => v).sort((a, b) => (a.year as number) - (b.year as number))
  }, [scenarios])

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-violet-500/5">
        <CardHeader>
          <CardTitle>إضافة سيناريو سريع</CardTitle>
          <CardDescription>اختر قالباً جاهزاً، ثم عدّل الافتراضات والإسقاطات لاحقاً.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.name}
              variant="outline"
              size="sm"
              onClick={() => addPreset(p.name)}
              disabled={scenarios.some((s) => s.name === p.name)}
            >
              <span className="ml-2 inline-block size-2 rounded-full" style={{ backgroundColor: p.color }} />
              + {p.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      {loading && (
        <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
      )}

      {!loading && scenarios.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا توجد سيناريوهات بعد — ابدأ بقالب من فوق.
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>مقارنة الإيرادات</CardTitle>
            <CardDescription>الإيرادات المتوقعة عبر السنوات لكل سيناريو.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(v: number) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v)} />
                <Legend />
                {scenarios.map((s, i) => (
                  <Line key={s.id} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {scenarios.map((s, i) => {
          const preset = PRESETS.find((p) => p.name === s.name)
          return (
            <Card key={s.id} className={preset?.accent ?? ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: preset?.color ?? COLORS[i % COLORS.length] }} />
                  {s.name}
                </CardTitle>
                <CardDescription>{s.assumptions.length} افتراض · {s.projections.length} سنة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">الافتراضات</div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {s.assumptions.map((a, idx) => (
                      <li key={idx} className="rounded-md border bg-card px-2 py-1">{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">الإسقاطات</div>
                  <table className="mt-1 w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-right">السنة</th>
                        <th className="text-right">الإيراد</th>
                        <th className="text-right">الربح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.projections.map((p) => (
                        <tr key={p.year} className="border-t">
                          <td className="py-1 tabular-nums">{p.year}</td>
                          <td className="py-1 tabular-nums">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(p.revenue)}</td>
                          <td className="py-1 tabular-nums">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>حذف</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
