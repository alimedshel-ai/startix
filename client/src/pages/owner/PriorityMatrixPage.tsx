import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

type Quadrant = 'doFirst' | 'schedule' | 'delegate' | 'eliminate'

interface Item {
  id: string
  title: string
  quadrant: Quadrant
}

interface PriorityData {
  items: Item[]
}

const EMPTY: PriorityData = { items: [] }

const QUADRANTS: Record<Quadrant, { title: string; subtitle: string; icon: string; tint: string }> = {
  doFirst:   { title: 'افعلها أولاً', subtitle: 'أثر عالٍ × جهد منخفض', icon: '🔥', tint: 'border-emerald-300 bg-gradient-to-br from-emerald-500/15 to-transparent' },
  schedule:  { title: 'جدولها',       subtitle: 'أثر عالٍ × جهد عالٍ', icon: '🗓️', tint: 'border-sky-300 bg-gradient-to-br from-sky-500/15 to-transparent' },
  delegate:  { title: 'فوّضها',        subtitle: 'أثر منخفض × جهد منخفض', icon: '🤝', tint: 'border-amber-300 bg-gradient-to-br from-amber-500/15 to-transparent' },
  eliminate: { title: 'احذفها',       subtitle: 'أثر منخفض × جهد عالٍ', icon: '🗑️', tint: 'border-rose-300 bg-gradient-to-br from-rose-500/15 to-transparent' },
}

export function PriorityMatrixPage() {
  return (
    <StrategicShell
      title="مصفوفة الأولوية"
      description="مصفوفة الأثر × الجهد. ضع كل مبادرة في الربع المناسب لتقرر ما تنفّذه أولاً."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<PriorityData>(EMPTY)
  const [newTitle, setNewTitle] = useState('')
  const [newQuad, setNewQuad] = useState<Quadrant>('doFirst')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<PriorityData>(companyId, 'PRIORITY_MATRIX').then((row) => {
      if (row?.data?.items) setData({ items: row.data.items })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    const v = newTitle.trim()
    if (!v) return
    setData((p) => ({ items: [...p.items, { id: crypto.randomUUID(), title: v, quadrant: newQuad }] }))
    setNewTitle('')
  }
  function move(id: string, quadrant: Quadrant) {
    setData((p) => ({ items: p.items.map((i) => (i.id === id ? { ...i, quadrant } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ items: p.items.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'PRIORITY_MATRIX', data)
      toast.success('تم حفظ المصفوفة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const byQuad = (q: Quadrant) => data.items.filter((i) => i.quadrant === q)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>إضافة مبادرة</CardTitle>
          <CardDescription>{data.items.length} عنصر في المصفوفة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[200px]"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="اسم المبادرة…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={newQuad}
              onChange={(e) => setNewQuad(e.target.value as Quadrant)}
            >
              {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => (
                <option key={q} value={q}>{QUADRANTS[q].title}</option>
              ))}
            </select>
            <Button onClick={add}>إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {(['doFirst', 'schedule', 'delegate', 'eliminate'] as Quadrant[]).map((q) => {
          const meta = QUADRANTS[q]
          const items = byQuad(q)
          return (
            <Card key={q} className={meta.tint}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{meta.icon}</span>
                  {meta.title}
                  <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({items.length})</span>
                </CardTitle>
                <CardDescription>{meta.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm">
                      <span className="flex-1">{i.title}</span>
                      <select
                        className="rounded-md border bg-background px-1.5 py-1 text-xs"
                        value={i.quadrant}
                        onChange={(e) => move(i.id, e.target.value as Quadrant)}
                      >
                        {(Object.keys(QUADRANTS) as Quadrant[]).map((qk) => (
                          <option key={qk} value={qk}>{QUADRANTS[qk].title}</option>
                        ))}
                      </select>
                      <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      لا توجد عناصر — أضف من فوق.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المصفوفة'}</Button>
      </div>
    </>
  )
}
