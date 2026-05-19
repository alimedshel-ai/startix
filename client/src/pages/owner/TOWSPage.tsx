import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { aiTowsSuggestions } from '@/lib/aiApi'
import { getSWOT, putTOWS, suggestTOWS } from '@/lib/strategicApi'

type Quad = 'so' | 'wo' | 'st' | 'wt'

interface TOWSData {
  so: string[]
  wo: string[]
  st: string[]
  wt: string[]
}

const EMPTY: TOWSData = { so: [], wo: [], st: [], wt: [] }

const QUADS: { key: Quad; title: string; subtitle: string; icon: string; tint: string }[] = [
  { key: 'so', title: 'استراتيجيات SO', subtitle: 'استخدام نقاط القوة لاقتناص الفرص',     icon: '🚀', tint: 'border-emerald-200 bg-emerald-50/40' },
  { key: 'wo', title: 'استراتيجيات WO', subtitle: 'معالجة نقاط الضعف لاقتناص الفرص',     icon: '🔧', tint: 'border-sky-200 bg-sky-50/40' },
  { key: 'st', title: 'استراتيجيات ST', subtitle: 'استخدام نقاط القوة لمواجهة التهديدات', icon: '🛡️', tint: 'border-violet-200 bg-violet-50/40' },
  { key: 'wt', title: 'استراتيجيات WT', subtitle: 'معالجة نقاط الضعف لتفادي التهديدات',   icon: '⚓', tint: 'border-rose-200 bg-rose-50/40' },
]

export function TOWSPage() {
  return (
    <StrategicShell
      title="مصفوفة TOWS"
      description="اشتقاق أربع استراتيجيات من تقاطع نقاط القوة والضعف مع الفرص والتهديدات."
      actions={
        <Link to="/swot" className={buttonVariants({ variant: 'outline' })}>
          ← العودة لتحليل SWOT
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<TOWSData>(EMPTY)
  const [drafts, setDrafts] = useState<Record<Quad, string>>({ so: '', wo: '', st: '', wt: '' })
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasSwot, setHasSwot] = useState(true)
  const [swotData, setSwotData] = useState<{ strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } | null>(null)
  const [useAI, setUseAI] = useState(true)

  useEffect(() => {
    getSWOT(companyId).then((s) => {
      const empty = (s.strengths.length + s.weaknesses.length + s.opportunities.length + s.threats.length) === 0
      setHasSwot(!empty)
      setSwotData({
        strengths: s.strengths ?? [],
        weaknesses: s.weaknesses ?? [],
        opportunities: s.opportunities ?? [],
        threats: s.threats ?? [],
      })
      if (s.tows) {
        setData({
          so: s.tows.so ?? [],
          wo: s.tows.wo ?? [],
          st: s.tows.st ?? [],
          wt: s.tows.wt ?? [],
        })
      }
    }).catch(() => undefined)
  }, [companyId])

  async function generate() {
    setSuggesting(true)
    try {
      const tows = useAI && swotData
        ? await aiTowsSuggestions({ companyId, swot: swotData })
        : await suggestTOWS(companyId)
      setData({
        so: [...data.so, ...(tows.so ?? [])],
        wo: [...data.wo, ...(tows.wo ?? [])],
        st: [...data.st, ...(tows.st ?? [])],
        wt: [...data.wt, ...(tows.wt ?? [])],
      })
      toast.success(useAI ? 'تم توليد مقترحات Claude' : 'تم توليد المقترحات')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد المقترحات'))
    } finally {
      setSuggesting(false)
    }
  }

  function add(q: Quad) {
    const v = drafts[q].trim()
    if (!v) return
    setData((p) => ({ ...p, [q]: [...p[q], v] }))
    setDrafts((p) => ({ ...p, [q]: '' }))
  }
  function remove(q: Quad, i: number) {
    setData((p) => ({ ...p, [q]: p[q].filter((_, idx) => idx !== i) }))
  }

  async function save() {
    setSaving(true)
    try {
      await putTOWS(companyId, data)
      toast.success('تم حفظ TOWS')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-violet-500/10 via-primary/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{useAI ? '🤖' : '🔀'}</span>
              {useAI ? 'توليد بالذكاء الاصطناعي' : 'توليد آلي بسيط'}
            </CardTitle>
            <CardDescription>
              {useAI
                ? 'Claude يحلل تقاطعات SWOT ويقترح 8–12 استراتيجية تنفيذية.'
                : 'تقاطعات تلقائية حسابياً (بدون ذكاء اصطناعي).'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
              <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
              استخدم Claude
            </label>
            <Button onClick={generate} disabled={suggesting || !hasSwot}>
              {suggesting ? 'جاري التوليد…' : '✨ توليد مقترحات'}
            </Button>
          </div>
        </CardHeader>
        {!hasSwot && (
          <CardContent className="text-sm">
            <p className="text-amber-700">
              لا يوجد تحليل SWOT بعد.{' '}
              <Link to="/swot" className="font-medium underline">ابدأ بتحليل SWOT</Link>
              {' '}قبل توليد مصفوفة TOWS.
            </p>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {QUADS.map((q) => (
          <Card key={q.key} className={q.tint}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{q.icon}</span>
                {q.title}
                <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({data[q.key].length})</span>
              </CardTitle>
              <CardDescription>{q.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={drafts[q.key]}
                  onChange={(e) => setDrafts((p) => ({ ...p, [q.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(q.key))}
                  placeholder="أضف استراتيجية…"
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
                  <li className="text-xs text-muted-foreground">لا توجد استراتيجيات بعد.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المصفوفة'}</Button>
      </div>
    </>
  )
}
