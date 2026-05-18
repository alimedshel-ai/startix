import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface AmbitionGapData {
  ambition: number   // 0-100, target maturity / aspiration
  current: number    // 0-100
  ambitionStatement: string
  enablers: string[]
  blockers: string[]
}

const EMPTY: AmbitionGapData = {
  ambition: 80,
  current: 40,
  ambitionStatement: '',
  enablers: [],
  blockers: [],
}

function diff(a: AmbitionGapData): number {
  return Math.max(0, a.ambition - a.current)
}

function recommendation(gap: number): { headline: string; tone: string; advice: string } {
  if (gap >= 50) return {
    headline: 'فجوة كبيرة جداً',
    tone: 'border-rose-300 bg-rose-50/60 text-rose-900',
    advice: 'الطموح بعيد عن الواقع الحالي — اعمل خطة تحول جذرية على 18–24 شهراً مع مراحل وسيطة قابلة للقياس.',
  }
  if (gap >= 30) return {
    headline: 'فجوة كبيرة',
    tone: 'border-orange-300 bg-orange-50/60 text-orange-900',
    advice: 'خطة 12–18 شهر مع تركيز على 2–3 مبادرات تحويلية. أضِف موارد ومتابعة شهرية.',
  }
  if (gap >= 15) return {
    headline: 'فجوة متوسطة',
    tone: 'border-amber-300 bg-amber-50/60 text-amber-900',
    advice: 'خطة 6–12 شهر تركز على تحسين العمليات الحالية وإغلاق نقاط الضعف الجوهرية.',
  }
  if (gap > 0) return {
    headline: 'فجوة صغيرة',
    tone: 'border-emerald-300 bg-emerald-50/60 text-emerald-900',
    advice: 'الطموح قريب من المتناول. ركّز على التنفيذ الصارم لمدة 3–6 أشهر.',
  }
  return {
    headline: 'لا توجد فجوة',
    tone: 'border-emerald-300 bg-emerald-50/60 text-emerald-900',
    advice: 'الوضع الحالي يطابق الطموح — ارفع سقف الطموح أو حافظ على الأداء.',
  }
}

export function AmbitionGapPage() {
  return (
    <StrategicShell
      title="فجوة الطموح"
      description="قارن سقف الطموح بمستوى النضج الحالي، وحدد المُمكنات والعوائق."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<AmbitionGapData>(EMPTY)
  const [newEnabler, setNewEnabler] = useState('')
  const [newBlocker, setNewBlocker] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<AmbitionGapData>(companyId, 'AMBITION_GAP').then((row) => {
      if (row?.data) {
        setData({
          ambition: row.data.ambition ?? EMPTY.ambition,
          current: row.data.current ?? EMPTY.current,
          ambitionStatement: row.data.ambitionStatement ?? '',
          enablers: row.data.enablers ?? [],
          blockers: row.data.blockers ?? [],
        })
      }
    }).catch(() => undefined)
  }, [companyId])

  function addItem(list: 'enablers' | 'blockers', value: string, setter: (v: string) => void) {
    const v = value.trim()
    if (!v) return
    setData((p) => ({ ...p, [list]: [...p[list], v] }))
    setter('')
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'AMBITION_GAP', data)
      toast.success('تم حفظ فجوة الطموح')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const gap = diff(data)
  const rec = recommendation(gap)

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-violet-500/5">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
        <CardHeader>
          <CardTitle>الطموح مقابل الحالي</CardTitle>
          <CardDescription>اضبط السقفين أدناه — الفجوة تظهر فوراً.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>🎯 سقف الطموح</span>
                <span className="tabular-nums text-lg font-bold text-emerald-700">{data.ambition}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={data.ambition}
                onChange={(e) => setData((p) => ({ ...p, ambition: Number(e.target.value) }))}
                className="mt-2 w-full accent-emerald-600"
              />
              <Progress value={data.ambition} className="mt-2 h-1.5" />
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>📍 المستوى الحالي</span>
                <span className="tabular-nums text-lg font-bold text-rose-700">{data.current}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={data.current}
                onChange={(e) => setData((p) => ({ ...p, current: Number(e.target.value) }))}
                className="mt-2 w-full accent-rose-600"
              />
              <Progress value={data.current} className="mt-2 h-1.5" />
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${rec.tone}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{rec.headline}</span>
              <span className="text-3xl font-bold tabular-nums">{gap}%</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{rec.advice}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>بيان الطموح</CardTitle>
          <CardDescription>جملة واحدة تصف وضع الشركة بعد سنتين.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={data.ambitionStatement}
            onChange={(e) => setData((p) => ({ ...p, ambitionStatement: e.target.value }))}
            placeholder="بعد سنتين، شركتنا ستكون…"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span>⚡</span> المُمكنات
              <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({data.enablers.length})</span>
            </CardTitle>
            <CardDescription>ما الذي يساعدك في الوصول للطموح؟</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={newEnabler}
                onChange={(e) => setNewEnabler(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('enablers', newEnabler, setNewEnabler))}
                placeholder="مثال: تمويل جاهز، فريق متمرّس…"
              />
              <Button variant="outline" size="sm" onClick={() => addItem('enablers', newEnabler, setNewEnabler)}>إضافة</Button>
            </div>
            <ul className="space-y-1.5">
              {data.enablers.map((v, i) => (
                <li key={`${v}-${i}`} className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-sm">
                  <span>{v}</span>
                  <button onClick={() => setData((p) => ({ ...p, enablers: p.enablers.filter((_, idx) => idx !== i) }))} className="text-xs text-muted-foreground">حذف</button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span>🚧</span> العوائق
              <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({data.blockers.length})</span>
            </CardTitle>
            <CardDescription>ما الذي قد يمنعك؟</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={newBlocker}
                onChange={(e) => setNewBlocker(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('blockers', newBlocker, setNewBlocker))}
                placeholder="مثال: نقص الكفاءات، تنظيم بطيء…"
              />
              <Button variant="outline" size="sm" onClick={() => addItem('blockers', newBlocker, setNewBlocker)}>إضافة</Button>
            </div>
            <ul className="space-y-1.5">
              {data.blockers.map((v, i) => (
                <li key={`${v}-${i}`} className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-sm">
                  <span>{v}</span>
                  <button onClick={() => setData((p) => ({ ...p, blockers: p.blockers.filter((_, idx) => idx !== i) }))} className="text-xs text-muted-foreground">حذف</button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
      </div>
    </>
  )
}
