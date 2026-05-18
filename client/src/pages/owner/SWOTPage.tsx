import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getSWOT, putSWOT, type SWOT } from '@/lib/strategicApi'

type Quadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats'

interface Data {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

const QUADRANTS: { key: Quadrant; title: string; icon: string; tint: string; helper: string }[] = [
  { key: 'strengths',     title: 'نقاط القوة',     icon: '💪', tint: 'border-emerald-200 bg-emerald-50/40', helper: 'مزايا داخلية تميّزك.' },
  { key: 'weaknesses',    title: 'نقاط الضعف',     icon: '🔻', tint: 'border-rose-200 bg-rose-50/40',       helper: 'نقاط ضعف داخلية تحتاج معالجة.' },
  { key: 'opportunities', title: 'الفرص',          icon: '🌱', tint: 'border-sky-200 bg-sky-50/40',         helper: 'فرص خارجية يمكن اقتناصها.' },
  { key: 'threats',       title: 'التهديدات',      icon: '⚠️', tint: 'border-amber-200 bg-amber-50/40',     helper: 'تهديدات خارجية قد تضرّك.' },
]

const EMPTY: Data = { strengths: [], weaknesses: [], opportunities: [], threats: [] }

export function SWOTPage() {
  return (
    <StrategicShell
      title="تحليل SWOT"
      description="مصفوفة رباعية: نقاط القوة، الضعف، الفرص، والتهديدات."
      actions={
        <Link to="/tows" className={buttonVariants({ variant: 'outline' })}>
          توليد مصفوفة TOWS ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<Data>(EMPTY)
  const [drafts, setDrafts] = useState<Record<Quadrant, string>>({ strengths: '', weaknesses: '', opportunities: '', threats: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSWOT(companyId).then((s: SWOT) => {
      setData({
        strengths: s.strengths ?? [],
        weaknesses: s.weaknesses ?? [],
        opportunities: s.opportunities ?? [],
        threats: s.threats ?? [],
      })
    }).catch(() => undefined)
  }, [companyId])

  function add(q: Quadrant) {
    const v = drafts[q].trim()
    if (!v) return
    setData((p) => ({ ...p, [q]: [...p[q], v] }))
    setDrafts((p) => ({ ...p, [q]: '' }))
  }
  function remove(q: Quadrant, i: number) {
    setData((p) => ({ ...p, [q]: p[q].filter((_, idx) => idx !== i) }))
  }

  async function save() {
    setSaving(true)
    try {
      await putSWOT(companyId, data)
      toast.success('تم حفظ التحليل')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((q) => (
          <Card key={q.key} className={q.tint}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{q.icon}</span>
                {q.title}
                <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({data[q.key].length})</span>
              </CardTitle>
              <CardDescription>{q.helper}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={drafts[q.key]}
                  onChange={(e) => setDrafts((p) => ({ ...p, [q.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(q.key))}
                  placeholder="أضف عنصراً واضغط Enter…"
                />
                <Button variant="outline" size="sm" onClick={() => add(q.key)}>إضافة</Button>
              </div>
              <ul className="space-y-1.5">
                {data[q.key].map((item, i) => (
                  <li key={`${item}-${i}`} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                    <span className="flex-1 leading-relaxed">{item}</span>
                    <button
                      type="button"
                      onClick={() => remove(q.key, i)}
                      className="text-xs text-muted-foreground transition hover:text-destructive"
                    >
                      حذف
                    </button>
                  </li>
                ))}
                {data[q.key].length === 0 && (
                  <li className="text-xs text-muted-foreground">لا توجد عناصر بعد.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ التحليل'}</Button>
      </div>
    </>
  )
}
