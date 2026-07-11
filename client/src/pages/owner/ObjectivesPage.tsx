import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { createObjective, deleteObjective, getArtifact, listObjectives, updateObjective, type Objective } from '@/lib/strategicApi'

const TYPES = [
  ['financial',    'مالي'],
  ['customer',     'عميل'],
  ['operations',   'تشغيلي'],
  ['people',       'موارد بشرية'],
  ['innovation',   'ابتكار'],
] as const

const STATUS = [
  ['active',     'نشط',     'border-sky-300 bg-sky-50/60'],
  ['achieved',   'محقق',     'border-emerald-300 bg-emerald-50/60'],
  ['cancelled',  'ملغى',     'border-rose-300 bg-rose-50/60'],
  ['paused',     'متوقف',    'border-amber-300 bg-amber-50/60'],
] as const

function statusTint(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[2] ?? 'border-slate-200 bg-card'
}
function statusLabel(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[1] ?? s
}
function typeLabel(t: string): string {
  return TYPES.find((x) => x[0] === t)?.[1] ?? t
}

function progressFromOKRs(o: Objective): number {
  if (!o.okrs?.length) return 0
  const totals = o.okrs.map((k) => (k.targetValue === 0 ? 0 : Math.min(100, (k.currentValue / k.targetValue) * 100)))
  return Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
}

export function ObjectivesPage() {
  return (
    <StrategicShell
      title="الأهداف الاستراتيجية"
      description="إنشاء ومتابعة 5–7 أهداف SMART مرتبطة بالاتجاه الاستراتيجي."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [params] = useSearchParams()
  const clientQS = params.get('client') ? `?client=${params.get('client')}` : ''
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  // فحص جاهزية BSC — إن ما كان محفوظاً نُخفي زر الاستيراد ونعرض CTA واضحاً.
  const [hasBSC, setHasBSC] = useState<boolean | null>(null)
  const [form, setForm] = useState({ title: '', description: '', type: TYPES[0][0] as string })

  useEffect(() => {
    listObjectives(companyId).then(setObjectives).catch(() => undefined).finally(() => setLoading(false))
    // فحص BSC — رفض هادئ يُظهر false، النجاح مع بيانات = true.
    getArtifact<{ perspectives?: unknown }>(companyId, 'BSC')
      .then((art) => setHasBSC(!!art?.data?.perspectives))
      .catch(() => setHasBSC(false))
  }, [companyId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const o = await createObjective({ companyId, title: form.title, description: form.description, type: form.type })
      setObjectives((p) => [...p, o])
      setForm({ title: '', description: '', type: form.type })
      toast.success('تم إنشاء الهدف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function update(o: Objective, patch: Partial<Objective>) {
    try {
      const updated = await updateObjective(o.id, patch)
      setObjectives((p) => p.map((x) => (x.id === o.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(o: Objective) {
    if (!confirm(`حذف الهدف "${o.title}"؟`)) return
    try {
      await deleteObjective(o.id)
      setObjectives((p) => p.filter((x) => x.id !== o.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // ─── ترابط: BSC → Objectives ─────────────────────────────────
  // كل بُعد BSC (financial/customer/internal/learning) عنده حقل objectives
  // نصّي. نُقسّم على أسطر جديدة ونُنشئ Objective لكل سطر مع type مطابق:
  //   financial → 'financial'
  //   customer  → 'customer'
  //   internal  → 'operations'
  //   learning  → 'people'
  async function importFromBSC() {
    setImporting(true)
    try {
      interface BSCPerspective { objectives: string; measures: string; initiatives: string; target: string }
      interface BSC { perspectives: Record<'financial' | 'customer' | 'internal' | 'learning', BSCPerspective> }
      const art = await getArtifact<BSC>(companyId, 'BSC')
      const persp = art?.data?.perspectives
      if (!persp) {
        // نظرياً لن يصل الكود إلى هنا لأن الزر مُخفى — لكن للأمان.
        setHasBSC(false)
        toast.error('لم يتم إعداد Balanced Scorecard بعد. افتح صفحة BSC وأنشئ الأبعاد الأربعة ثم عد.')
        return
      }
      const bscTypeMap: Record<string, string> = {
        financial: 'financial',
        customer: 'customer',
        internal: 'operations',
        learning: 'people',
      }
      const existingTitles = new Set(objectives.map((o) => o.title))
      let added = 0
      for (const key of ['financial', 'customer', 'internal', 'learning'] as const) {
        const p = persp[key]
        if (!p?.objectives) continue
        const lines = p.objectives.split('\n').map((l) => l.replace(/^[•\-·]\s*/, '').trim()).filter(Boolean)
        for (const line of lines) {
          if (existingTitles.has(line)) continue
          try {
            const o = await createObjective({
              companyId,
              title: line,
              description: `من بُعد BSC ${key} · مقاييس: ${p.measures || 'غير محدّدة'}`,
              type: bscTypeMap[key],
            })
            setObjectives((p2) => [...p2, o])
            added++
          } catch { /* تخطّى الفشل الفردي */ }
        }
      }
      if (added === 0) toast.error('كل أهداف BSC مُستوردَة سابقاً.')
      else toast.success(`أُضيف ${added} هدفاً من BSC — راجعها وأضِف OKRs.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستيراد من BSC'))
    } finally {
      setImporting(false)
    }
  }

  const counts = {
    active: objectives.filter((o) => o.status === 'active').length,
    achieved: objectives.filter((o) => o.status === 'achieved').length,
    cancelled: objectives.filter((o) => o.status === 'cancelled').length,
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader>
            <CardDescription>نشط</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-sky-700">{counts.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <CardDescription>محقق</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{counts.achieved}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-rose-200 bg-rose-50/60">
          <CardHeader>
            <CardDescription>ملغى</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-rose-700">{counts.cancelled}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>هدف جديد</CardTitle>
            <CardDescription>SMART: محدد، قابل للقياس، قابل للتحقيق، ذو صلة، محدد زمنياً.</CardDescription>
          </div>
          {/* زر الاستيراد يظهر فقط لو BSC مكتَمل. وإلا نُظهر رابطاً واضحاً. */}
          {hasBSC === true && (
            <Button variant="outline" size="sm" onClick={importFromBSC} disabled={importing}>
              {importing ? 'جاري…' : '⚖️ استورد من BSC'}
            </Button>
          )}
          {hasBSC === false && (
            <Link
              to={`/bsc${clientQS}`}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
              title="أنشئ Balanced Scorecard أوّلاً لتستورد أهدافه هنا"
            >
              ⚖️ أنشئ BSC أوّلاً ←
            </Link>
          )}
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: زيادة الإيرادات 30%…" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="description">الوصف</Label>
              <Textarea id="description" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
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
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating || !form.title.trim()}>
                {creating ? 'جاري الإنشاء…' : '+ إنشاء الهدف'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      <div className="grid gap-3 md:grid-cols-2">
        {objectives.map((o) => {
          const prog = progressFromOKRs(o)
          return (
            <Card key={o.id} className={statusTint(o.status)}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{o.title}</CardTitle>
                  <span className="rounded-md border bg-card px-2 py-0.5 text-xs">{typeLabel(o.type)}</span>
                </div>
                {o.description && <CardDescription className="leading-relaxed">{o.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>تقدم النتائج الرئيسية</span>
                    <span className="tabular-nums">{prog}%</span>
                  </div>
                  <Progress value={prog} className="mt-1 h-2" />
                  <p className="mt-1 text-[10px] text-muted-foreground">{o.okrs?.length ?? 0} نتيجة رئيسية</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={o.status}
                    onChange={(e) => update(o, { status: e.target.value })}
                  >
                    {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">{statusLabel(o.status)}</span>
                  <Button variant="ghost" size="sm" className="mr-auto" onClick={() => remove(o)}>حذف</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {!loading && objectives.length === 0 && (
          <Card className="border-dashed md:col-span-2">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد أهداف بعد. أنشئ هدفك الأول من الأعلى.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
