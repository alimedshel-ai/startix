import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

type Quadrant = 'marketPenetration' | 'productDevelopment' | 'marketDevelopment' | 'diversification'

interface Initiative {
  id: string
  title: string
  quadrant: Quadrant
}

interface AnsoffData {
  initiatives: Initiative[]
}

const EMPTY: AnsoffData = { initiatives: [] }

const QUADRANTS: Record<Quadrant, { title: string; subtitle: string; risk: string; icon: string; tint: string }> = {
  marketPenetration:  { title: 'اختراق السوق',     subtitle: 'منتج حالي · سوق حالي',  risk: 'مخاطرة منخفضة', icon: '🎯', tint: 'border-emerald-300 bg-emerald-50/60' },
  productDevelopment: { title: 'تطوير المنتج',     subtitle: 'منتج جديد · سوق حالي',  risk: 'مخاطرة متوسطة', icon: '🛠️', tint: 'border-sky-300 bg-sky-50/60' },
  marketDevelopment:  { title: 'تطوير السوق',      subtitle: 'منتج حالي · سوق جديد',  risk: 'مخاطرة متوسطة', icon: '🌍', tint: 'border-amber-300 bg-amber-50/60' },
  diversification:    { title: 'التنويع',          subtitle: 'منتج جديد · سوق جديد',  risk: 'مخاطرة عالية',  icon: '🚀', tint: 'border-rose-300 bg-rose-50/60' },
}

export function AnsoffMatrixPage() {
  return (
    <StrategicShell
      title="مصفوفة أنسوف"
      description="2×2 منتج × سوق: اختراق السوق، تطوير المنتج، تطوير السوق، التنويع."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<AnsoffData>(EMPTY)
  const [title, setTitle] = useState('')
  const [quad, setQuad] = useState<Quadrant>('marketPenetration')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<AnsoffData>(companyId, 'ANSOFF').then((row) => {
      if (row?.data?.initiatives) setData({ initiatives: row.data.initiatives })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    const v = title.trim()
    if (!v) return
    setData((p) => ({ initiatives: [...p.initiatives, { id: crypto.randomUUID(), title: v, quadrant: quad }] }))
    setTitle('')
  }
  function move(id: string, q: Quadrant) {
    setData((p) => ({ initiatives: p.initiatives.map((i) => (i.id === id ? { ...i, quadrant: q } : i)) }))
  }
  function remove(id: string) {
    setData((p) => ({ initiatives: p.initiatives.filter((i) => i.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'ANSOFF', data)
      toast.success('تم حفظ مصفوفة أنسوف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const byQuad = (q: Quadrant) => data.initiatives.filter((i) => i.quadrant === q)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>إضافة مبادرة نمو</CardTitle>
          <CardDescription>{data.initiatives.length} مبادرة موزّعة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="مثال: توسع لمدن جديدة، إطلاق نسخة Pro…"
            />
            <select
              className="rounded-md border bg-background px-3 text-sm"
              value={quad}
              onChange={(e) => setQuad(e.target.value as Quadrant)}
            >
              {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => (
                <option key={q} value={q}>{QUADRANTS[q].title}</option>
              ))}
            </select>
            <Button onClick={add}>إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المصفوفة 2×2</CardTitle>
          <CardDescription>الصف العلوي = سوق حالي. الصف السفلي = سوق جديد.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[100px_1fr_1fr] gap-2 text-sm">
            <div />
            <div className="text-center text-xs font-semibold text-muted-foreground">منتج حالي</div>
            <div className="text-center text-xs font-semibold text-muted-foreground">منتج جديد</div>

            <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground">سوق حالي</div>
            <QuadrantBox q="marketPenetration" items={byQuad('marketPenetration')} onMove={move} onRemove={remove} />
            <QuadrantBox q="productDevelopment" items={byQuad('productDevelopment')} onMove={move} onRemove={remove} />

            <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground">سوق جديد</div>
            <QuadrantBox q="marketDevelopment" items={byQuad('marketDevelopment')} onMove={move} onRemove={remove} />
            <QuadrantBox q="diversification" items={byQuad('diversification')} onMove={move} onRemove={remove} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المصفوفة'}</Button>
      </div>
    </>
  )
}

function QuadrantBox({
  q, items, onMove, onRemove,
}: {
  q: Quadrant
  items: Initiative[]
  onMove: (id: string, q: Quadrant) => void
  onRemove: (id: string) => void
}) {
  const meta = QUADRANTS[q]
  return (
    <div className={`rounded-xl border p-3 ${meta.tint}`}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-semibold">
          <span>{meta.icon}</span>
          {meta.title}
        </span>
        <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{meta.risk}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
            <span className="flex-1">{i.title}</span>
            <select
              className="rounded-md border bg-background px-1 py-0.5 text-[10px]"
              value={i.quadrant}
              onChange={(e) => onMove(i.id, e.target.value as Quadrant)}
            >
              {(Object.keys(QUADRANTS) as Quadrant[]).map((qk) => (
                <option key={qk} value={qk}>{QUADRANTS[qk].title}</option>
              ))}
            </select>
            <button onClick={() => onRemove(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">
            لا توجد مبادرات
          </li>
        )}
      </ul>
    </div>
  )
}
