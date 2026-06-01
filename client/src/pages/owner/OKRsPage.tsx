import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import {
  createOKR, deleteOKR, listObjectives, updateOKR,
  type OKR, type Objective,
} from '@/lib/strategicApi'

function pct(k: OKR): number {
  if (!k.targetValue) return 0
  return Math.min(100, Math.round((k.currentValue / k.targetValue) * 100))
}

function tint(p: number): string {
  if (p >= 80) return 'border-emerald-300 bg-emerald-50/60'
  if (p >= 50) return 'border-sky-300 bg-sky-50/60'
  if (p >= 25) return 'border-amber-300 bg-amber-50/60'
  return 'border-rose-300 bg-rose-50/60'
}

export function OKRsPage() {
  return (
    <StrategicShell
      title="النتائج الرئيسية (OKRs)"
      description="نتائج قابلة للقياس لكل هدف. حدّث القيمة الحالية لتتبع التقدم."
      actions={
        <Link to="/objectives" className={buttonVariants({ variant: 'outline' })}>
          الانتقال للأهداف ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listObjectives(companyId).then(setObjectives).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  async function addOKR(objectiveId: string) {
    const keyResult = prompt('النتيجة الرئيسية:')
    if (!keyResult?.trim()) return
    const targetStr = prompt('القيمة المستهدفة (رقم):', '100')
    const target = Number(targetStr)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('قيمة مستهدفة غير صالحة')
      return
    }
    const unit = prompt('الوحدة (مثال: %, SAR, ساعات):', '%') ?? undefined
    try {
      const okr = await createOKR({ objectiveId, keyResult, targetValue: target, unit })
      setObjectives((p) => p.map((o) => (o.id === objectiveId ? { ...o, okrs: [...(o.okrs ?? []), okr] } : o)))
      toast.success('تمت إضافة النتيجة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإضافة'))
    }
  }

  async function updateCurrent(objectiveId: string, okrId: string, currentValue: number) {
    try {
      const updated = await updateOKR(okrId, { currentValue })
      setObjectives((p) => p.map((o) => (o.id === objectiveId
        ? { ...o, okrs: (o.okrs ?? []).map((k) => (k.id === okrId ? { ...k, ...updated } : k)) }
        : o)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(objectiveId: string, okrId: string) {
    if (!confirm('حذف هذه النتيجة الرئيسية؟')) return
    try {
      await deleteOKR(okrId)
      setObjectives((p) => p.map((o) => (o.id === objectiveId
        ? { ...o, okrs: (o.okrs ?? []).filter((k) => k.id !== okrId) }
        : o)))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  const allOKRs = objectives.flatMap((o) => o.okrs ?? [])
  const avgProgress = allOKRs.length === 0
    ? 0
    : Math.round(allOKRs.reduce((s, k) => s + pct(k), 0) / allOKRs.length)

  if (loading) {
    return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
  }

  return (
    <>
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-amber-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>متوسط التقدم</CardTitle>
          <CardDescription>{allOKRs.length} نتيجة رئيسية عبر {objectives.length} هدف.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums text-emerald-700">{avgProgress}%</div>
          <Progress value={avgProgress} className="mt-2 h-2" />
        </CardContent>
      </Card>

      {objectives.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا توجد أهداف. أنشئ هدفاً أولاً في صفحة الأهداف، ثم أضف له نتائج رئيسية هنا.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {objectives.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{o.title}</CardTitle>
                  <CardDescription>{(o.okrs ?? []).length} نتيجة رئيسية</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => addOKR(o.id)}>+ نتيجة</Button>
              </div>
            </CardHeader>
            <CardContent>
              {(o.okrs ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                  لا توجد نتائج بعد. اضغط "+ نتيجة" لإضافة أول واحدة.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(o.okrs ?? []).map((k) => {
                    const p = pct(k)
                    return (
                      <li key={k.id} className={`rounded-xl border p-3 ${tint(p)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{k.keyResult}</div>
                            <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                              الهدف: {k.targetValue.toLocaleString('ar-SA')}{k.unit ? ` ${k.unit}` : ''}
                            </div>
                          </div>
                          <span className="rounded-md border bg-card px-2 py-1 text-xs font-bold tabular-nums">{p}%</span>
                          <button onClick={() => remove(o.id, k.id)} className="text-xs text-muted-foreground hover:text-destructive">حذف</button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            className="h-8 w-32 bg-background tabular-nums"
                            type="number"
                            value={k.currentValue}
                            onChange={(e) => updateCurrent(o.id, k.id, Number(e.target.value) || 0)}
                          />
                          <span className="text-xs text-muted-foreground">القيمة الحالية</span>
                          <Progress value={p} className="ml-3 h-1.5 flex-1" />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
