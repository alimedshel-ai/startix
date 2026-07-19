import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { OutsideRescueBanner } from '@/components/manager/OutsideRescueBanner'
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
  const [searchParams] = useSearchParams()
  const isRescueMode = searchParams.get('from') === 'emergency'
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
      {/* 🚨 تحذير: خارج مسار الإنقاذ الرباعيّ */}
      {isRescueMode && (
        <OutsideRescueBanner
          companyId={companyId}
          toolName="التوجّه الاستراتيجي"
          whyOutside="اختيار اتّجاه استراتيجيّ يفترض الاستقرار. في المنطقة الحمراء، الإنقاذ أوّلاً قبل قرار الاتّجاه."
        />
      )}
      {/* شريط أدوات علوي: العدد + الإضافة/الاستيراد في مكان واحد واضح */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            الاتجاهات المحتملة
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">{data.directions.length}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">قيّم كل اتجاه بقابلية التنفيذ × الأثر — الأعلى يُرشَّح للقرار.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={add}>+ اتجاه جديد</Button>
          <Button variant="outline" size="sm" onClick={importFromTOWS} disabled={importing || saving}>
            {importing ? 'جاري الاستيراد…' : '🔄 استورد من TOWS'}
          </Button>
        </div>
      </div>

      {data.directions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="text-3xl" aria-hidden>🎯</div>
            <p className="max-w-sm text-sm text-muted-foreground">لا اتجاهات بعد. ابدأ باتجاه جديد، أو استورد استراتيجيّات TOWS تلقائياً كنقطة انطلاق.</p>
            <div className="flex gap-2">
              <Button onClick={add}>+ اتجاه جديد</Button>
              <Button variant="outline" onClick={importFromTOWS} disabled={importing}>🔄 استورد من TOWS</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
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

        {/* الترتيب الحيّ بجانب البطاقات — يربط كل اتجاه بأولويّته مباشرةً */}
        <aside className="h-fit space-y-3 lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🏆 الترتيب حسب الأولويّة</CardTitle>
              <CardDescription className="text-xs">قابلية × أثر — الأعلى يُرشَّح أوّلاً للقرار.</CardDescription>
            </CardHeader>
            <CardContent>
              {ranked.length > 0 ? (
                <ol className="space-y-2 text-sm">
                  {ranked.map((d, i) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                        <span className="truncate font-medium">{d.title}</span>
                      </span>
                      <span className="shrink-0 rounded-md border bg-card px-1.5 py-0.5 text-xs font-bold tabular-nums" title={`قابلية ${d.feasibility} × أثر ${d.impact}`}>{score(d)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">أضِف عنواناً لكل اتجاه ليظهر ترتيبه هنا.</p>
              )}
            </CardContent>
          </Card>

          {/* دليل ألوان البطاقات — لفهم التقييم بنظرة */}
          <div className="rounded-lg border bg-card p-2.5 text-[11px] text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">دليل اللون (قابلية × أثر)</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded border border-emerald-300 bg-emerald-50/60 px-1.5 py-0.5">١٦+ ممتاز</span>
              <span className="rounded border border-sky-300 bg-sky-50/60 px-1.5 py-0.5">١٠+ جيّد</span>
              <span className="rounded border border-amber-300 bg-amber-50/60 px-1.5 py-0.5">٥+ متوسّط</span>
              <span className="rounded border border-rose-300 bg-rose-50/60 px-1.5 py-0.5">&lt;٥ ضعيف</span>
            </div>
          </div>
        </aside>
      </div>
      )}

      {/* شريط حفظ ثابت أسفل الصفحة — لا يضيع مهما طالت الصفحة */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-card p-3 shadow-lg">
        <div className="text-xs text-muted-foreground">
          <b className="text-foreground tabular-nums">{data.directions.filter((d) => d.title.trim()).length}</b> اتجاه جاهز · احفظ لتثبيتها قبل الانتقال للقرار.
        </div>
        <Button onClick={save} disabled={saving || importing} size="lg">
          {saving ? 'جاري الحفظ…' : '💾 حفظ الاتجاهات'}
        </Button>
      </div>
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
