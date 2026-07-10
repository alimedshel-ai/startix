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
import { createProject, deleteProject, listInitiatives, listProjects, updateProject, type Initiative, type Project } from '@/lib/strategicApi'

const STATUS = [
  ['active',    'نشط',     'border-sky-300 bg-sky-50/60'],
  ['planning',  'تخطيط',    'border-amber-300 bg-amber-50/60'],
  ['done',      'مكتمل',    'border-emerald-300 bg-emerald-50/60'],
  ['paused',    'متوقف',    'border-slate-200 bg-slate-50/60'],
  ['cancelled', 'ملغى',     'border-rose-300 bg-rose-50/60'],
] as const

function sTint(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[2] ?? 'border-slate-200 bg-card'
}
function sLabel(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[1] ?? s
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ProjectsPage() {
  return (
    <StrategicShell
      title="المشاريع"
      description="المشاريع التي تنفّذ المبادرات. تواريخ، حالات، ومهام."
      actions={
        <Link to="/gantt-chart" className={buttonVariants({ variant: 'outline' })}>
          عرض جانت ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Project[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10)
  const [form, setForm] = useState({ title: '', description: '', startDate: today, endDate: future })

  useEffect(() => {
    listProjects(companyId).then(setItems).catch(() => undefined).finally(() => setLoading(false))
    listInitiatives(companyId).then(setInitiatives).catch(() => undefined)
  }, [companyId])

  // ─── ترابط: Initiatives → Projects ─────────────────────────────
  // كل مبادرة بحالة planned/in_progress تُنشئ مشروعاً عملياً بتاريخ
  // بداية = اليوم، نهاية = بعد 90 يوماً. المدير يعدّل التواريخ لاحقاً
  // في /gantt-chart.
  async function importFromInitiatives() {
    if (initiatives.length === 0) {
      toast.error('لا مبادرات مسجّلة — افتح /initiatives أوّلاً.')
      return
    }
    setImporting(true)
    try {
      const existingTitles = new Set(items.map((p) => p.title))
      const eligible = initiatives.filter((i) => i.status === 'planned' || i.status === 'in_progress')
      let added = 0
      for (const i of eligible) {
        if (existingTitles.has(i.title)) continue
        try {
          const p = await createProject({
            companyId, initiativeId: i.id,
            title: i.title,
            description: i.description ?? undefined,
            startDate: today, endDate: future,
          })
          setItems((prev) => [...prev, p])
          added++
        } catch { /* skip */ }
      }
      if (added === 0) toast.error('كل المبادرات المؤهّلة مُستوردَة سابقاً.')
      else toast.success(`أُنشئ ${added} مشروعاً من المبادرات — عدّل التواريخ في /gantt-chart.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من المبادرات'))
    } finally {
      setImporting(false)
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const p = await createProject({
        companyId,
        title: form.title,
        description: form.description,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      })
      setItems((prev) => [...prev, p])
      setForm({ title: '', description: '', startDate: today, endDate: future })
      toast.success('تم إنشاء المشروع')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function update(p: Project, patch: Partial<Project>) {
    try {
      const updated = await updateProject(p.id, patch)
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(p: Project) {
    if (!confirm(`حذف المشروع "${p.title}"؟`)) return
    try {
      await deleteProject(p.id)
      setItems((prev) => prev.filter((x) => x.id !== p.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>مشروع جديد</CardTitle>
            <CardDescription>تواريخ البدء والانتهاء تظهر في مخطط جانت.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={importFromInitiatives} disabled={importing}>
            {importing ? 'جاري…' : '💡 استورد من المبادرات'}
          </Button>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: إطلاق التطبيق…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="start">تاريخ البدء</Label>
              <Input id="start" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">تاريخ الانتهاء</Label>
              <Input id="end" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label htmlFor="desc">الوصف</Label>
              <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" disabled={creating || !form.title.trim()}>{creating ? 'جاري الإنشاء…' : '+ إنشاء المشروع'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => (
          <Card key={p.id} className={sTint(p.status)}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base leading-tight">{p.title}</CardTitle>
                <span className="rounded-md border bg-card px-2 py-0.5 text-xs">{sLabel(p.status)}</span>
              </div>
              {p.description && <CardDescription className="leading-relaxed">{p.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border bg-card px-2 py-1">
                  <div className="text-muted-foreground">البدء</div>
                  <div className="tabular-nums font-medium">{fmtDate(p.startDate)}</div>
                </div>
                <div className="rounded-md border bg-card px-2 py-1">
                  <div className="text-muted-foreground">الانتهاء</div>
                  <div className="tabular-nums font-medium">{fmtDate(p.endDate)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                  value={p.status}
                  onChange={(e) => update(p, { status: e.target.value })}
                >
                  {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <span className="text-xs text-muted-foreground tabular-nums">{p.tasks?.length ?? 0} مهمة</span>
                <Button variant="ghost" size="sm" className="mr-auto" onClick={() => remove(p)}>حذف</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && items.length === 0 && (
          <Card className="border-dashed md:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد مشاريع بعد.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
