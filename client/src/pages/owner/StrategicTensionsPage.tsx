import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Tension {
  id: string
  leftLabel: string
  rightLabel: string
  balance: number // 0-100, 0 = fully left, 100 = fully right, 50 = balanced
  notes: string
  severity: 1 | 2 | 3 | 4 | 5
}

interface TensionsData {
  tensions: Tension[]
}

const EMPTY: TensionsData = { tensions: [] }

const PRESETS: { leftLabel: string; rightLabel: string }[] = [
  { leftLabel: 'النمو', rightLabel: 'الربحية' },
  { leftLabel: 'السرعة', rightLabel: 'الجودة' },
  { leftLabel: 'المركزية', rightLabel: 'اللامركزية' },
  { leftLabel: 'الابتكار', rightLabel: 'الكفاءة' },
  { leftLabel: 'الاستثمار', rightLabel: 'الادخار' },
  { leftLabel: 'الاستقطاب', rightLabel: 'التطوير الداخلي' },
]

function severityTint(s: number): string {
  if (s >= 4) return 'border-rose-300 bg-rose-50/60'
  if (s >= 3) return 'border-amber-300 bg-amber-50/60'
  return 'border-emerald-300 bg-emerald-50/60'
}

function severityLabel(s: number): string {
  if (s >= 5) return 'حادة'
  if (s >= 4) return 'مرتفعة'
  if (s >= 3) return 'متوسطة'
  if (s >= 2) return 'منخفضة'
  return 'هامشية'
}

export function StrategicTensionsPage() {
  return (
    <StrategicShell
      title="التوترات الاستراتيجية"
      description="أولويات متعارضة تحتاج موازنة. لكل توتر، حدد طرفيه، ميله الحالي، وكيف ستوازن."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<TensionsData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<TensionsData>(companyId, 'STRATEGIC_TENSIONS').then((row) => {
      if (row?.data?.tensions) setData({ tensions: row.data.tensions })
    }).catch(() => undefined)
  }, [companyId])

  function add(preset?: { leftLabel: string; rightLabel: string }) {
    setData((p) => ({
      tensions: [
        ...p.tensions,
        {
          id: crypto.randomUUID(),
          leftLabel: preset?.leftLabel ?? '',
          rightLabel: preset?.rightLabel ?? '',
          balance: 50,
          notes: '',
          severity: 3,
        },
      ],
    }))
  }
  function update(id: string, patch: Partial<Tension>) {
    setData((p) => ({ tensions: p.tensions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  }
  function remove(id: string) {
    setData((p) => ({ tensions: p.tensions.filter((t) => t.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'STRATEGIC_TENSIONS', data)
      toast.success('تم حفظ التوترات')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const hot = data.tensions.filter((t) => t.severity >= 4).length

  return (
    <>
      <Card className="overflow-hidden border-violet-200 bg-gradient-to-bl from-violet-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{data.tensions.length} توتر مسجّل</CardTitle>
              <CardDescription>{hot} منها حاد (شدة 4 أو 5).</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => add()} variant="outline" size="sm">+ توتر فارغ</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => add(p)}
              className="rounded-full border bg-card px-3 py-1 text-xs transition hover:bg-accent"
            >
              + {p.leftLabel} ↔ {p.rightLabel}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {data.tensions.map((t) => (
          <Card key={t.id} className={severityTint(t.severity)}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-40 bg-background"
                  value={t.leftLabel}
                  onChange={(e) => update(t.id, { leftLabel: e.target.value })}
                  placeholder="الطرف الأيمن…"
                />
                <span className="text-xl">↔</span>
                <Input
                  className="w-40 bg-background"
                  value={t.rightLabel}
                  onChange={(e) => update(t.id, { rightLabel: e.target.value })}
                  placeholder="الطرف الأيسر…"
                />
                <span className="mr-auto inline-flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">الشدة:</span>
                  <select
                    className="rounded-md border bg-background px-2 py-1"
                    value={t.severity}
                    onChange={(e) => update(t.id, { severity: Number(e.target.value) as Tension['severity'] })}
                  >
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} — {severityLabel(v)}</option>)}
                  </select>
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)}>×</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-rose-700">{t.leftLabel || '—'} ({100 - t.balance}%)</span>
                  <span className="font-medium text-emerald-700">{t.rightLabel || '—'} ({t.balance}%)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={t.balance}
                  onChange={(e) => update(t.id, { balance: Number(e.target.value) })}
                  className="mt-1 w-full"
                />
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  {t.balance < 30 ? 'ميل قوي لليمين' : t.balance < 45 ? 'ميل خفيف لليمين' : t.balance <= 55 ? 'متوازن' : t.balance < 70 ? 'ميل خفيف لليسار' : 'ميل قوي لليسار'}
                </p>
              </div>
              <Textarea
                rows={2}
                className="bg-background"
                value={t.notes}
                onChange={(e) => update(t.id, { notes: e.target.value })}
                placeholder="كيف ستوازن هذا التوتر؟"
              />
            </CardContent>
          </Card>
        ))}
        {data.tensions.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد توترات بعد. اختر من القوالب الجاهزة فوق أو أضف توتراً مخصصاً.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ التوترات'}</Button>
      </div>
    </>
  )
}
