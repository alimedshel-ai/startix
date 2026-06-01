import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { createReview, listReviews, type Review } from '@/lib/strategicApi'

const TYPES = [
  ['monthly',   'شهرية'],
  ['quarterly', 'ربعية'],
  ['annual',    'سنوية'],
] as const

const OUTCOMES = [
  ['continue', 'متابعة',  'border-emerald-300 bg-emerald-50/60'],
  ['adjust',   'تعديل',    'border-amber-300 bg-amber-50/60'],
  ['pivot',    'تحوّل',     'border-rose-300 bg-rose-50/60'],
] as const

interface DraftCorrection {
  id: string
  title: string
  description: string
  owner: string
  dueDate: string
}

function tLabel(t: string) { return TYPES.find((x) => x[0] === t)?.[1] ?? t }
function oTint(o?: string | null) { return OUTCOMES.find((x) => x[0] === (o ?? ''))?.[2] ?? 'border-slate-200 bg-card' }
function oLabel(o?: string | null) { return OUTCOMES.find((x) => x[0] === (o ?? ''))?.[1] ?? '—' }

export function ReviewsPage() {
  return (
    <StrategicShell
      title="جلسات المراجعة"
      description="مراجعات دورية: ما تحقق، ما لم يتحقق، والمخرج (متابعة / تعديل / تحوّل)."
      actions={
        <Link to="/corrections" className={buttonVariants({ variant: 'outline' })}>
          الانتقال للإجراءات التصحيحية ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ type: 'monthly', outcome: 'continue', notes: '' })
  const [corrs, setCorrs] = useState<DraftCorrection[]>([])

  useEffect(() => {
    listReviews(companyId).then(setReviews).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  function addCorr() {
    setCorrs((p) => [...p, { id: crypto.randomUUID(), title: '', description: '', owner: '', dueDate: '' }])
  }
  function updateCorr(id: string, patch: Partial<DraftCorrection>) {
    setCorrs((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  function removeCorr(id: string) {
    setCorrs((p) => p.filter((c) => c.id !== id))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.notes.trim()) {
      toast.error('اكتب ملاحظات المراجعة')
      return
    }
    setSubmitting(true)
    try {
      const corrections = corrs
        .filter((c) => c.title.trim())
        .map((c) => ({
          title: c.title,
          description: c.description || undefined,
          owner: c.owner || undefined,
          dueDate: c.dueDate ? new Date(c.dueDate).toISOString() : null,
        }))
      const r = await createReview({
        companyId,
        type: form.type,
        outcome: form.outcome,
        notes: form.notes,
        corrections,
      })
      setReviews((p) => [r, ...p])
      setForm({ type: form.type, outcome: 'continue', notes: '' })
      setCorrs([])
      toast.success(corrections.length > 0
        ? `تم حفظ المراجعة + ${corrections.length} إجراء تصحيحي`
        : 'تم حفظ المراجعة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-orange-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-orange-500 via-amber-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>مراجعة جديدة</CardTitle>
          <CardDescription>اكتب الملاحظات وحدد المخرج. الإجراءات التصحيحية تُحفظ كقائمة مرتبطة.</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="type">النوع</Label>
              <select
                id="type"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="outcome">المخرج</Label>
              <select
                id="outcome"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.outcome}
                onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value }))}
              >
                {OUTCOMES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="notes">الملاحظات</Label>
              <Textarea
                id="notes"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="ما تحقق؟ ما لم يتحقق؟ السياق…"
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">إجراءات تصحيحية</div>
                  <p className="text-xs text-muted-foreground">سيتم إنشاؤها تلقائياً عند الحفظ.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCorr}>+ إجراء</Button>
              </div>
              <ul className="space-y-2">
                {corrs.map((c) => (
                  <li key={c.id} className="rounded-xl border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="min-w-[180px] flex-1"
                        value={c.title}
                        onChange={(e) => updateCorr(c.id, { title: e.target.value })}
                        placeholder="عنوان الإجراء…"
                      />
                      <Input
                        className="w-32"
                        value={c.owner}
                        onChange={(e) => updateCorr(c.id, { owner: e.target.value })}
                        placeholder="المسؤول"
                      />
                      <Input
                        className="w-36 tabular-nums"
                        type="date"
                        value={c.dueDate}
                        onChange={(e) => updateCorr(c.id, { dueDate: e.target.value })}
                      />
                      <button type="button" onClick={() => removeCorr(c.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
                    </div>
                    <Textarea
                      rows={2}
                      className="mt-2"
                      value={c.description}
                      onChange={(e) => updateCorr(c.id, { description: e.target.value })}
                      placeholder="وصف اختياري…"
                    />
                  </li>
                ))}
                {corrs.length === 0 && (
                  <li className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                    لا توجد إجراءات. أضف واحداً لو كان المخرج "تعديل" أو "تحوّل".
                  </li>
                )}
              </ul>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting || !form.notes.trim()}>{submitting ? 'جاري الحفظ…' : 'حفظ المراجعة'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      <Card>
        <CardHeader>
          <CardTitle>السجل</CardTitle>
          <CardDescription>{reviews.length} مراجعة.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className={`rounded-xl border p-3 ${oTint(r.outcome)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">مراجعة {tLabel(r.type)}</span>
                    <span className="rounded-md border bg-card px-2 py-0.5 text-[10px]">{oLabel(r.outcome)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{new Date(r.reviewedAt).toLocaleDateString('ar-SA')}</span>
                </div>
                {r.notes && <p className="mt-2 text-sm leading-relaxed">{r.notes}</p>}
              </li>
            ))}
            {!loading && reviews.length === 0 && (
              <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد مراجعات بعد.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
