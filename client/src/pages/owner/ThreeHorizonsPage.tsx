import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

type Horizon = 'h1' | 'h2' | 'h3'

interface Initiative {
  id: string
  title: string
  horizon: Horizon
  progress: number  // 0-100
}

interface ThreeHData {
  initiatives: Initiative[]
}

const EMPTY: ThreeHData = { initiatives: [] }

const HORIZONS: Record<Horizon, { title: string; subtitle: string; tint: string; icon: string; timeline: string }> = {
  h1: {
    title:    'الأفق 1 — الجوهر الحالي',
    subtitle: 'العمليات المُولّدة للدخل اليوم',
    tint:     'border-emerald-300 bg-gradient-to-br from-emerald-500/15 to-transparent',
    icon:     '🏗️',
    timeline: '0–12 شهر',
  },
  h2: {
    title:    'الأفق 2 — النامي',
    subtitle: 'مبادرات تنمو وتصبح جوهراً قريباً',
    tint:     'border-sky-300 bg-gradient-to-br from-sky-500/15 to-transparent',
    icon:     '🌱',
    timeline: '12–36 شهر',
  },
  h3: {
    title:    'الأفق 3 — التجريبي',
    subtitle: 'رهانات استكشافية لمستقبل بعيد',
    tint:     'border-violet-300 bg-gradient-to-br from-violet-500/15 to-transparent',
    icon:     '🔭',
    timeline: '36+ شهر',
  },
}

export function ThreeHorizonsPage() {
  return (
    <StrategicShell
      title="الآفاق الثلاثة"
      description="نموذج McKinsey للأفق الثلاثي: حافظ على الجوهر، اصنع النمو، استثمر في المستقبل."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<ThreeHData>(EMPTY)
  const [title, setTitle] = useState('')
  const [horizon, setHorizon] = useState<Horizon>('h1')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<ThreeHData>(companyId, 'THREE_HORIZONS').then((row) => {
      if (row?.data?.initiatives) setData({ initiatives: row.data.initiatives })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    const v = title.trim()
    if (!v) return
    setData((p) => ({ initiatives: [...p.initiatives, { id: crypto.randomUUID(), title: v, horizon, progress: 10 }] }))
    setTitle('')
  }
  function update(id: string, patch: Partial<Initiative>) {
    setData((p) => ({ initiatives: p.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ initiatives: p.initiatives.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'THREE_HORIZONS', data)
      toast.success('تم حفظ الآفاق')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const byH = (h: Horizon) => data.initiatives.filter((i) => i.horizon === h)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>إضافة مبادرة</CardTitle>
          <CardDescription>{data.initiatives.length} مبادرة موزّعة عبر الآفاق الثلاثة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="اسم المبادرة…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
            >
              {(Object.keys(HORIZONS) as Horizon[]).map((h) => (
                <option key={h} value={h}>{HORIZONS[h].title}</option>
              ))}
            </select>
            <Button onClick={add}>إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {(['h1', 'h2', 'h3'] as Horizon[]).map((h) => {
          const meta = HORIZONS[h]
          const items = byH(h)
          return (
            <Card key={h} className={meta.tint}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{meta.icon}</span>
                  {meta.title}
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>{meta.subtitle}</span>
                  <span className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium">{meta.timeline}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="space-y-2 rounded-lg border bg-card p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">{i.title}</span>
                        <select
                          className="rounded-md border bg-background px-1.5 py-0.5 text-[10px]"
                          value={i.horizon}
                          onChange={(e) => update(i.id, { horizon: e.target.value as Horizon })}
                        >
                          {(Object.keys(HORIZONS) as Horizon[]).map((hk) => (
                            <option key={hk} value={hk}>{HORIZONS[hk].title.split('—')[0]}</option>
                          ))}
                        </select>
                        <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>التقدم</span>
                          <span className="tabular-nums">{i.progress}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={i.progress}
                          onChange={(e) => update(i.id, { progress: Number(e.target.value) })}
                          className="w-full"
                        />
                        <Progress value={i.progress} className="mt-0.5 h-1" />
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      لا توجد مبادرات
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ الآفاق'}</Button>
      </div>
    </>
  )
}
