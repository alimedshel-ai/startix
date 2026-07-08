import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import {
  createDeal,
  deleteDeal,
  listDeals,
  updateDeal,
  DEAL_STATUS_LABEL,
  DEAL_STATUS_ORDER,
  type Deal,
  type DealStatus,
} from '@/lib/dealsApi'

// ─── C14 — خط أنابيب صفقات المستثمر ─────────────────────────────────────────
// عرض على شكل أعمدة كانبان لـ 5 حالات. صفقة = شركة هدف + قطاع + مرحلة +
// تقييم + حالة. الصفحة منفصلة عن PortfolioPage (قرار MVP في الخطة).

const SAR_FMT = new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
})

const STATUS_TONE: Record<DealStatus, string> = {
  lead: 'border-slate-300 bg-slate-50 dark:bg-slate-900/40',
  due_diligence: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
  term_sheet: 'border-sky-300 bg-sky-50 dark:bg-sky-900/20',
  closed_won: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
  closed_lost: 'border-rose-300 bg-rose-50 dark:bg-rose-900/20',
}

export function DealsPipelinePage() {
  return (
    <ErrorBoundary>
      <DealsPipelineContent />
    </ErrorBoundary>
  )
}

function DealsPipelineContent() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let cancel = false
    listDeals()
      .then((rows) => {
        if (!cancel) setDeals(rows)
      })
      .catch((err) => {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل الصفقات'))
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [])

  const columns = useMemo(() => {
    const grouped: Record<DealStatus, Deal[]> = {
      lead: [],
      due_diligence: [],
      term_sheet: [],
      closed_won: [],
      closed_lost: [],
    }
    for (const d of deals) grouped[d.status].push(d)
    return grouped
  }, [deals])

  async function moveStatus(deal: Deal, next: DealStatus) {
    const previous = deal.status
    // تحديث متفائل — نتراجع عند الفشل.
    setDeals((rows) => rows.map((r) => (r.id === deal.id ? { ...r, status: next } : r)))
    try {
      const updated = await updateDeal(deal.id, { status: next })
      setDeals((rows) => rows.map((r) => (r.id === deal.id ? updated : r)))
    } catch (err) {
      setDeals((rows) => rows.map((r) => (r.id === deal.id ? { ...r, status: previous } : r)))
      toast.error(apiErrorMessage(err, 'تعذّر تحديث الحالة'))
    }
  }

  async function remove(id: string) {
    if (!confirm('حذف هذه الصفقة نهائياً؟')) return
    try {
      await deleteDeal(id)
      setDeals((rows) => rows.filter((r) => r.id !== id))
      toast.success('تم حذف الصفقة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحذف'))
    }
  }

  async function onCreate(payload: {
    targetCompanyName: string
    sector?: string
    stage?: string
    valuation?: number
  }) {
    try {
      const row = await createDeal(payload)
      setDeals((rows) => [row, ...rows])
      setShowAdd(false)
      toast.success('تم إضافة الصفقة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر إضافة الصفقة'))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="خط أنابيب الصفقات" />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري تحميل الصفقات…" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="خط أنابيب الصفقات"
        description="صفقاتك من العميل المحتمل حتى الإغلاق."
        actions={
          <Button onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'إغلاق' : '＋ صفقة جديدة'}
          </Button>
        }
      />

      {showAdd && <AddDealForm onSubmit={onCreate} onCancel={() => setShowAdd(false)} />}

      {deals.length === 0 && !showAdd ? (
        <EmptyState
          title="لا توجد صفقات بعد"
          description="ابدأ بإضافة صفقتك الأولى لتنظيم خط أنابيب الاستثمار."
          icon={<span className="text-4xl">💼</span>}
          action={<Button onClick={() => setShowAdd(true)}>＋ إضافة صفقة</Button>}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {DEAL_STATUS_ORDER.map((status) => (
            <div key={status} className="flex flex-col gap-2">
              <div className={`rounded-lg border-2 border-b-0 px-3 py-2 text-xs font-semibold ${STATUS_TONE[status]}`}>
                {DEAL_STATUS_LABEL[status]}
                <span className="mr-2 tabular-nums text-muted-foreground">({columns[status].length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {columns[status].length === 0 && (
                  <div className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                    فارغ
                  </div>
                )}
                {columns[status].map((d) => (
                  <DealCard key={d.id} deal={d} onMove={(s) => moveStatus(d, s)} onDelete={() => remove(d.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DealCard({
  deal,
  onMove,
  onDelete,
}: {
  deal: Deal
  onMove: (next: DealStatus) => void
  onDelete: () => void
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium leading-snug">{deal.targetCompanyName}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {[deal.sector, deal.stage].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        {deal.valuation !== null && (
          <div className="whitespace-nowrap text-[11px] font-medium tabular-nums text-primary">
            {SAR_FMT.format(deal.valuation)}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <select
          value={deal.status}
          onChange={(e) => onMove(e.target.value as DealStatus)}
          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
        >
          {DEAL_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{DEAL_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border px-2 py-1 text-[10px] text-muted-foreground transition hover:border-destructive hover:text-destructive"
        >
          حذف
        </button>
      </div>
    </Card>
  )
}

function AddDealForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: { targetCompanyName: string; sector?: string; stage?: string; valuation?: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [stage, setStage] = useState('')
  const [valuation, setValuation] = useState('')

  function submit() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('اسم الشركة الهدف مطلوب')
      return
    }
    onSubmit({
      targetCompanyName: trimmedName,
      sector: sector.trim() || undefined,
      stage: stage.trim() || undefined,
      valuation: valuation.trim() ? Number(valuation) || undefined : undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>صفقة جديدة</CardTitle>
        <CardDescription>ابدأ بالعميل المحتمل — تقدر تعدّل الحالة لاحقاً.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="d_name">اسم الشركة الهدف *</Label>
          <Input id="d_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: شركة النمو" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d_sector">القطاع</Label>
          <Input id="d_sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="تقنية، صحة…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d_stage">المرحلة</Label>
          <Input id="d_stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="seed، series_a…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d_val">التقييم المتوقّع (SAR)</Label>
          <Input id="d_val" type="number" value={valuation} onChange={(e) => setValuation(e.target.value)} placeholder="5000000" />
        </div>
        <div className="col-span-full flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>إلغاء</Button>
          <Button onClick={submit}>إضافة</Button>
        </div>
      </CardContent>
    </Card>
  )
}
