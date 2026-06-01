import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface DirectionLite {
  id: string
  title: string
  description: string
  feasibility: number
  impact: number
}

interface ChoiceData {
  selectedDirectionId: string | null
  rationale: string
  decidedAt: string | null
  decidedTitle: string | null
}

const EMPTY: ChoiceData = {
  selectedDirectionId: null,
  rationale: '',
  decidedAt: null,
  decidedTitle: null,
}

export function ChoicesPage() {
  return (
    <StrategicShell
      title="القرار الاستراتيجي"
      description="اختر اتجاهاً واحداً من قائمة الاتجاهات، ودوّن المبررات. القرار يُقفَل عند الحفظ."
      actions={
        <Link to="/directions" className={buttonVariants({ variant: 'outline' })}>
          ← العودة للاتجاهات
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [directions, setDirections] = useState<DirectionLite[]>([])
  const [choice, setChoice] = useState<ChoiceData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getArtifact<{ directions: DirectionLite[] }>(companyId, 'DIRECTIONS'),
      getArtifact<ChoiceData>(companyId, 'CHOICES'),
    ]).then(([dirRow, choiceRow]) => {
      setDirections(dirRow?.data?.directions ?? [])
      if (choiceRow?.data) setChoice({ ...EMPTY, ...choiceRow.data })
    }).catch(() => undefined).finally(() => setLoaded(true))
  }, [companyId])

  async function commit() {
    if (!choice.selectedDirectionId) {
      toast.error('اختر اتجاهاً أولاً')
      return
    }
    if (!choice.rationale.trim()) {
      toast.error('اكتب مبرر القرار')
      return
    }
    const dir = directions.find((d) => d.id === choice.selectedDirectionId)
    if (!dir) {
      toast.error('الاتجاه المختار لم يعد موجوداً')
      return
    }
    setSaving(true)
    try {
      const payload: ChoiceData = {
        selectedDirectionId: dir.id,
        rationale: choice.rationale,
        decidedAt: new Date().toISOString(),
        decidedTitle: dir.title,
      }
      await upsertArtifact(companyId, 'CHOICES', payload)
      setChoice(payload)
      toast.success('تم تثبيت القرار')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل حفظ القرار'))
    } finally {
      setSaving(false)
    }
  }

  async function unlock() {
    if (!confirm('إعادة فتح القرار؟ سيمكنك اختيار اتجاه آخر.')) return
    try {
      await upsertArtifact(companyId, 'CHOICES', EMPTY)
      setChoice(EMPTY)
      toast.message('تم فتح القرار')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإلغاء'))
    }
  }

  if (!loaded) {
    return (
      <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
    )
  }

  const isLocked = Boolean(choice.decidedAt)

  if (directions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>لا توجد اتجاهات بعد</CardTitle>
          <CardDescription>أضف 3–5 اتجاهات في صفحة الاتجاهات الاستراتيجية قبل اختيار قرار.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/directions" className={buttonVariants()}>الانتقال للاتجاهات ←</Link>
        </CardContent>
      </Card>
    )
  }

  if (isLocked) {
    return (
      <>
        <Card className="overflow-hidden border-emerald-300 bg-gradient-to-bl from-emerald-500/15 to-transparent">
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <CardTitle>القرار مُثبَّت</CardTitle>
                <CardDescription>
                  مأخوذ في {new Date(choice.decidedAt!).toLocaleDateString('ar-SA')}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">الاتجاه المختار</div>
              <div className="mt-1 text-xl font-bold text-emerald-700">{choice.decidedTitle}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">المبررات</div>
              <p className="mt-1 leading-relaxed">{choice.rationale}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={unlock}>إعادة فتح القرار</Button>
          <Link to="/objectives" className={buttonVariants()}>
            ابدأ ترجمته لأهداف ←
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>اختر اتجاهاً</CardTitle>
          <CardDescription>{directions.length} اتجاه متاح.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {directions.map((d) => {
              const selected = choice.selectedDirectionId === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setChoice((p) => ({ ...p, selectedDirectionId: d.id }))}
                  className={`rounded-xl border p-4 text-right transition ${
                    selected
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'bg-card hover:-translate-y-0.5 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{d.title || '—'}</span>
                    <span className="rounded-md border bg-background px-2 py-0.5 text-xs tabular-nums">
                      {d.feasibility * d.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">{d.description || '—'}</p>
                  {selected && <div className="mt-2 text-xs font-medium text-primary">✓ مختار</div>}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المبررات</CardTitle>
          <CardDescription>لماذا اخترت هذا الاتجاه دون غيره؟</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={choice.rationale}
            onChange={(e) => setChoice((p) => ({ ...p, rationale: e.target.value }))}
            placeholder="مثال: هذا الاتجاه يستفيد من قوة الفريق ويعالج فجوة سوقية واضحة…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={commit} disabled={saving}>{saving ? 'جاري الحفظ…' : '🔒 تثبيت القرار'}</Button>
      </div>
    </>
  )
}
