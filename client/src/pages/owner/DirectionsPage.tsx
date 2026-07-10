import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getSWOT, upsertArtifact } from '@/lib/strategicApi'

export interface Direction {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  feasibility: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
}

interface DirectionsData {
  directions: Direction[]
}

const EMPTY: DirectionsData = { directions: [] }

function score(d: Direction): number {
  return d.feasibility * d.impact
}

function tint(s: number): string {
  if (s >= 16) return 'border-emerald-300 bg-emerald-50/60'
  if (s >= 10) return 'border-sky-300 bg-sky-50/60'
  if (s >= 5)  return 'border-amber-300 bg-amber-50/60'
  return 'border-rose-300 bg-rose-50/60'
}

export function DirectionsPage() {
  return (
    <StrategicShell
      title="الاتجاهات الاستراتيجية"
      description="حدد 3–5 اتجاهات محتملة، قيّم كل اتجاه بقابلية التنفيذ والأثر، ثم اختر الأفضل في صفحة القرارات."
      actions={
        <Link to="/choices" className={buttonVariants({ variant: 'outline' })}>
          الانتقال للقرار ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<DirectionsData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    getArtifact<DirectionsData>(companyId, 'DIRECTIONS').then((row) => {
      if (row?.data?.directions) setData({ directions: row.data.directions })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    setData((p) => ({
      directions: [
        ...p.directions,
        { id: crypto.randomUUID(), title: '', description: '', pros: [], cons: [], feasibility: 3, impact: 3 },
      ],
    }))
  }
  function update(id: string, patch: Partial<Direction>) {
    setData((p) => ({ directions: p.directions.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
  }
  function remove(id: string) {
    setData((p) => ({ directions: p.directions.filter((d) => d.id !== id) }))
  }
  function addItem(id: string, list: 'pros' | 'cons', value: string) {
    const v = value.trim()
    if (!v) return
    const d = data.directions.find((x) => x.id === id)
    if (!d) return
    update(id, { [list]: [...d[list], v] } as Partial<Direction>)
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'DIRECTIONS', data)
      toast.success('تم حفظ الاتجاهات')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  // ─── ترابط: TOWS → Directions ─────────────────────────────────
  // كل استراتيجية TOWS تُصبح اتجاهاً افتراضياً بـfeasibility/impact=3.
  // العنوان يُشتق من أول ٦٠ حرفاً من الاستراتيجية مع بادئة الربع
  // (SO/ST/WO/WT) — يبقى الوصف كاملاً في description.
  async function importFromTOWS() {
    setImporting(true)
    try {
      const swot = await getSWOT(companyId)
      const tows = swot.tows
      if (!tows || (
        (tows.so?.length ?? 0) + (tows.st?.length ?? 0) +
        (tows.wo?.length ?? 0) + (tows.wt?.length ?? 0) === 0
      )) {
        toast.error('لا استراتيجيات TOWS محفوظة — افتح /tows أوّلاً.')
        return
      }
      const pairs: [string, string[]][] = [
        ['SO', tows.so ?? []],
        ['ST', tows.st ?? []],
        ['WO', tows.wo ?? []],
        ['WT', tows.wt ?? []],
      ]
      const newDirections: Direction[] = []
      const existingTitles = new Set(data.directions.map((d) => d.description))
      for (const [quad, list] of pairs) {
        for (const strat of list) {
          const clean = strat.trim()
          if (!clean || existingTitles.has(clean)) continue
          const title = `[${quad}] ${clean.slice(0, 60)}${clean.length > 60 ? '…' : ''}`
          newDirections.push({
            id: crypto.randomUUID(),
            title,
            description: clean,
            pros: [], cons: [],
            feasibility: 3, impact: 3,
          })
        }
      }
      if (newDirections.length === 0) {
        toast.error('كل الاستراتيجيات مُستوردَة مسبقاً.')
        return
      }
      setData((p) => ({ directions: [...p.directions, ...newDirections] }))
      toast.success(`أُضيف ${newDirections.length} اتجاهاً من TOWS — راجع الجدوى والأثر ثم احفظ.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من TOWS'))
    } finally {
      setImporting(false)
    }
  }

  const ranked = [...data.directions].filter((d) => d.title.trim()).sort((a, b) => score(b) - score(a))

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {data.directions.map((d) => {
          const s = score(d)
          return (
            <Card key={d.id} className={tint(s)}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 bg-background font-medium"
                    value={d.title}
                    onChange={(e) => update(d.id, { title: e.target.value })}
                    placeholder="عنوان الاتجاه…"
                  />
                  <span className="rounded-md border bg-card px-2 py-1 text-xs font-bold tabular-nums">{s}</span>
                  <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>×</Button>
                </div>
                <Textarea
                  rows={2}
                  className="mt-2 bg-background"
                  value={d.description}
                  onChange={(e) => update(d.id, { description: e.target.value })}
                  placeholder="وصف موجز للاتجاه…"
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="rounded-md border bg-card px-2 py-1.5">
                    <span className="text-muted-foreground">قابلية التنفيذ</span>
                    <select
                      className="ml-1 rounded-md border bg-background px-1.5"
                      value={d.feasibility}
                      onChange={(e) => update(d.id, { feasibility: Number(e.target.value) as Direction['feasibility'] })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="rounded-md border bg-card px-2 py-1.5">
                    <span className="text-muted-foreground">الأثر</span>
                    <select
                      className="ml-1 rounded-md border bg-background px-1.5"
                      value={d.impact}
                      onChange={(e) => update(d.id, { impact: Number(e.target.value) as Direction['impact'] })}
                    >
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                </div>

                <ProsCons direction={d} onAdd={addItem} onRemove={(list, idx) => update(d.id, { [list]: d[list].filter((_, i) => i !== idx) } as Partial<Direction>)} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={add}>+ اتجاه جديد</Button>
          <Button variant="outline" onClick={importFromTOWS} disabled={importing || saving}>
            {importing ? 'جاري الاستيراد…' : '🔄 استورد من TOWS'}
          </Button>
        </div>
        <Button onClick={save} disabled={saving || importing}>{saving ? 'جاري الحفظ…' : 'حفظ الاتجاهات'}</Button>
      </div>

      {ranked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الترتيب حسب القابلية × الأثر</CardTitle>
            <CardDescription>الأعلى ترتيباً هو الأكثر جاذبية للتنفيذ.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {ranked.map((d, i) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                    <span className="font-medium">{d.title}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">قابلية {d.feasibility} × أثر {d.impact} = {score(d)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function ProsCons({
  direction,
  onAdd,
  onRemove,
}: {
  direction: Direction
  onAdd: (id: string, list: 'pros' | 'cons', value: string) => void
  onRemove: (list: 'pros' | 'cons', idx: number) => void
}) {
  const [pro, setPro] = useState('')
  const [con, setCon] = useState('')
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Lane
        label="إيجابيات"
        accent="bg-emerald-100 text-emerald-900"
        items={direction.pros}
        draft={pro}
        setDraft={setPro}
        onSubmit={() => { onAdd(direction.id, 'pros', pro); setPro('') }}
        onRemove={(i) => onRemove('pros', i)}
      />
      <Lane
        label="سلبيات"
        accent="bg-rose-100 text-rose-900"
        items={direction.cons}
        draft={con}
        setDraft={setCon}
        onSubmit={() => { onAdd(direction.id, 'cons', con); setCon('') }}
        onRemove={(i) => onRemove('cons', i)}
      />
    </div>
  )
}

function Lane({
  label, accent, items, draft, setDraft, onSubmit, onRemove,
}: {
  label: string
  accent: string
  items: string[]
  draft: string
  setDraft: (v: string) => void
  onSubmit: () => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="rounded-lg border bg-card p-2 text-xs">
      <div className={`mb-1 inline-block rounded-md px-2 py-0.5 ${accent}`}>{label}</div>
      <div className="flex gap-1">
        <input
          className="flex-1 rounded-md border bg-background px-2 py-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onSubmit())}
          placeholder="إضافة…"
        />
        <button className="rounded-md border bg-background px-2 transition hover:bg-accent" onClick={onSubmit}>+</button>
      </div>
      <ul className="mt-1 space-y-1">
        {items.map((v, i) => (
          <li key={`${v}-${i}`} className="flex items-center justify-between rounded-md border bg-background px-2 py-1">
            <span>{v}</span>
            <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">×</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
