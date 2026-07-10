import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { createInitiative, deleteInitiative, getArtifact, getSWOT, listInitiatives, updateInitiative, type Initiative } from '@/lib/strategicApi'

const PRIORITIES = [
  ['critical', 'حرجة',   'border-rose-300 bg-rose-50/60'],
  ['high',     'مرتفعة',  'border-orange-300 bg-orange-50/60'],
  ['medium',   'متوسطة',  'border-amber-300 bg-amber-50/60'],
  ['low',      'منخفضة',  'border-emerald-300 bg-emerald-50/60'],
] as const

const STATUS = [
  ['planned',     'مخططة'],
  ['in_progress', 'قيد التنفيذ'],
  ['done',        'مكتملة'],
  ['cancelled',   'ملغاة'],
] as const

function pTint(p: string): string {
  return PRIORITIES.find((x) => x[0] === p)?.[2] ?? 'border-slate-200 bg-card'
}
function pLabel(p: string): string {
  return PRIORITIES.find((x) => x[0] === p)?.[1] ?? p
}
function sLabel(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[1] ?? s
}

export function InitiativesPage() {
  return (
    <StrategicShell
      title="المبادرات الاستراتيجية"
      description="مبادرات تجمع المشاريع تحت موضوع موحد لتنفيذ الاتجاه الاستراتيجي."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importingSyn, setImportingSyn] = useState<'tows' | 'directions' | null>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'high' })

  useEffect(() => {
    listInitiatives(companyId).then(setItems).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const i = await createInitiative({ companyId, title: form.title, description: form.description, priority: form.priority })
      setItems((p) => [...p, i])
      setForm({ title: '', description: '', priority: form.priority })
      toast.success('تمت إضافة المبادرة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function update(i: Initiative, patch: Partial<Initiative>) {
    try {
      const updated = await updateInitiative(i.id, patch)
      setItems((p) => p.map((x) => (x.id === i.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(i: Initiative) {
    if (!confirm(`حذف المبادرة "${i.title}"؟`)) return
    try {
      await deleteInitiative(i.id)
      setItems((p) => p.filter((x) => x.id !== i.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // ─── ترابط: TOWS → Initiatives ─────────────────────────────────
  // كل استراتيجية TOWS تُصبح مبادرة. الأولوية:
  //   SO/WO → high  (فرص — يجب اقتناصها)
  //   ST/WT → critical (تهديدات — تحتاج تحرّكاً عاجلاً)
  async function importFromTOWS() {
    setImportingSyn('tows')
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
      const existingTitles = new Set(items.map((x) => x.title))
      const pairs: [string, string[], 'critical' | 'high'][] = [
        ['SO', tows.so ?? [], 'high'],
        ['WO', tows.wo ?? [], 'high'],
        ['ST', tows.st ?? [], 'critical'],
        ['WT', tows.wt ?? [], 'critical'],
      ]
      let added = 0
      for (const [quad, list, priority] of pairs) {
        for (const strat of list) {
          const clean = strat.trim()
          if (!clean) continue
          const title = `[${quad}] ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`
          if (existingTitles.has(title)) continue
          try {
            const i = await createInitiative({ companyId, title, description: clean, priority })
            setItems((p) => [...p, i])
            added++
          } catch { /* تجاهل الفشل الفردي وأكمل الباقي */ }
        }
      }
      if (added === 0) toast.error('كل الاستراتيجيات مُستوردَة سابقاً.')
      else toast.success(`أُضيف ${added} مبادرة من TOWS`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من TOWS'))
    } finally {
      setImportingSyn(null)
    }
  }

  // ─── ترابط: Directions → Initiatives ───────────────────────────
  // كل اتجاه في DIRECTIONS يُصبح مبادرة. الأولوية تعتمد على score:
  //   feasibility × impact ≥ 16 → high
  //   10..15 → medium
  //   ≤ 9    → low
  async function importFromDirections() {
    setImportingSyn('directions')
    try {
      interface D { title: string; description: string; feasibility: number; impact: number }
      const art = await getArtifact<{ directions: D[] }>(companyId, 'DIRECTIONS')
      const dirs = art?.data?.directions ?? []
      if (dirs.length === 0) {
        toast.error('لا اتجاهات محفوظة — افتح /directions أوّلاً.')
        return
      }
      const existingTitles = new Set(items.map((x) => x.title))
      let added = 0
      for (const d of dirs) {
        if (!d.title?.trim()) continue
        if (existingTitles.has(d.title)) continue
        const s = d.feasibility * d.impact
        const priority = s >= 16 ? 'high' : s >= 10 ? 'medium' : 'low'
        try {
          const i = await createInitiative({ companyId, title: d.title, description: d.description, priority })
          setItems((p) => [...p, i])
          added++
        } catch { /* تجاهل الفشل الفردي */ }
      }
      if (added === 0) toast.error('كل الاتجاهات مُستوردَة سابقاً.')
      else toast.success(`أُضيف ${added} مبادرة من الاتجاهات`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من الاتجاهات'))
    } finally {
      setImportingSyn(null)
    }
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>مبادرة جديدة</CardTitle>
            <CardDescription>اربط مبادراتك بالاتجاه الاستراتيجي والأهداف.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={importFromTOWS} disabled={importingSyn !== null}>
              {importingSyn === 'tows' ? 'جاري…' : '🔄 من TOWS'}
            </Button>
            <Button variant="outline" size="sm" onClick={importFromDirections} disabled={importingSyn !== null}>
              {importingSyn === 'directions' ? 'جاري…' : '🎯 من الاتجاهات'}
            </Button>
          </div>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: إطلاق برنامج ولاء…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="priority">الأولوية</Label>
              <select
                id="priority"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label htmlFor="desc">الوصف</Label>
              <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={creating || !form.title.trim()}>{creating ? 'جاري الإنشاء…' : '+ إنشاء المبادرة'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.id} className={pTint(i.priority)}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base leading-tight">{i.title}</CardTitle>
                <span className="rounded-md border bg-card px-2 py-0.5 text-xs">{pLabel(i.priority)}</span>
              </div>
              {i.description && <CardDescription className="leading-relaxed">{i.description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={i.status}
                onChange={(e) => update(i, { status: e.target.value })}
              >
                {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <span className="text-xs text-muted-foreground">{sLabel(i.status)}</span>
              <Button variant="ghost" size="sm" className="mr-auto" onClick={() => remove(i)}>حذف</Button>
            </CardContent>
          </Card>
        ))}
        {!loading && items.length === 0 && (
          <Card className="border-dashed md:col-span-2">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد مبادرات بعد.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
