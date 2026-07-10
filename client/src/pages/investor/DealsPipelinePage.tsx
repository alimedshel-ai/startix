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

// ─── C14 — خط أنابيب صفقات المستثمر ─────────────────────────────────
// كانبان بخمس حالات. الصفحة تحوي: إحصائيات، فلاتر، بحث، إضافة ذكيّة.
// كل الحقول (القطاع/المرحلة) قوائم موحّدة بدل نص حرّ — يوحّد التصفية.

const SAR_FMT = new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
})

const STATUS_TONE: Record<DealStatus, string> = {
  lead:          'border-slate-300 bg-slate-50 dark:bg-slate-900/40',
  due_diligence: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
  term_sheet:    'border-sky-300 bg-sky-50 dark:bg-sky-900/20',
  closed_won:    'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
  closed_lost:   'border-rose-300 bg-rose-50 dark:bg-rose-900/20',
}

const STATUS_ICON: Record<DealStatus, string> = {
  lead:          '📥',
  due_diligence: '🔍',
  term_sheet:    '📄',
  closed_won:    '✅',
  closed_lost:   '❌',
}

// ─── قوائم موحّدة — قطاع + مرحلة ───────────────────────────────
interface SectorOpt { code: string; label: string; icon: string }

const SECTORS: SectorOpt[] = [
  { code: 'fintech',       label: 'فنتك',              icon: '💳' },
  { code: 'saas',          label: 'SaaS/برمجيات',       icon: '☁️' },
  { code: 'ecommerce',     label: 'تجارة إلكترونية',   icon: '🛒' },
  { code: 'healthtech',    label: 'صحة رقمية',         icon: '🏥' },
  { code: 'edtech',        label: 'تعليم رقمي',        icon: '📚' },
  { code: 'foodtech',      label: 'أغذية وتوصيل',      icon: '🍽️' },
  { code: 'logistics',     label: 'لوجستيات',          icon: '🚚' },
  { code: 'mobility',      label: 'نقل وتنقّل',        icon: '🚗' },
  { code: 'proptech',      label: 'عقار رقمي',         icon: '🏢' },
  { code: 'gaming',        label: 'ألعاب وترفيه',       icon: '🎮' },
  { code: 'cleantech',     label: 'طاقة نظيفة/بيئة',   icon: '🌱' },
  { code: 'ai',            label: 'ذكاء اصطناعي',      icon: '🤖' },
  { code: 'cybersecurity', label: 'أمن سيبراني',       icon: '🛡️' },
  { code: 'manufacturing', label: 'تصنيع',             icon: '🏭' },
  { code: 'retail',        label: 'تجزئة تقليدية',     icon: '🛍️' },
  { code: 'other',         label: 'أخرى',              icon: '📦' },
]

interface StageOpt { code: string; label: string; icon: string; typicalTicket: string }

const STAGES: StageOpt[] = [
  { code: 'idea',      label: 'فكرة',              icon: '💡', typicalTicket: '< 100K' },
  { code: 'pre_seed',  label: 'ما قبل التأسيس',    icon: '🌱', typicalTicket: '100K–500K' },
  { code: 'seed',      label: 'تأسيسي (Seed)',     icon: '🌿', typicalTicket: '500K–3M' },
  { code: 'series_a',  label: 'Series A',           icon: '🚀', typicalTicket: '3M–10M' },
  { code: 'series_b',  label: 'Series B',           icon: '📈', typicalTicket: '10M–30M' },
  { code: 'series_c',  label: 'Series C+',          icon: '🏆', typicalTicket: '30M+' },
  { code: 'growth',    label: 'نمو / توسّع',        icon: '🌊', typicalTicket: '10M–50M' },
  { code: 'pre_ipo',   label: 'ما قبل الطرح',       icon: '💎', typicalTicket: '50M+' },
]

const SECTOR_MAP = new Map(SECTORS.map((s) => [s.code, s]))
const STAGE_MAP = new Map(STAGES.map((s) => [s.code, s]))

function sectorMeta(code: string | null | undefined): SectorOpt | null {
  if (!code) return null
  return SECTOR_MAP.get(code) ?? { code, label: code, icon: '📦' }
}
function stageMeta(code: string | null | undefined): StageOpt | null {
  if (!code) return null
  return STAGE_MAP.get(code) ?? { code, label: code, icon: '🎯', typicalTicket: '—' }
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
  const [query, setQuery] = useState('')
  const [filterSector, setFilterSector] = useState<string>('')
  const [filterStage, setFilterStage] = useState<string>('')

  useEffect(() => {
    let cancel = false
    listDeals()
      .then((rows) => { if (!cancel) setDeals(rows) })
      .catch((err) => { if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل الصفقات')) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [])

  // ─── فلترة ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals.filter((d) => {
      if (q && !d.targetCompanyName.toLowerCase().includes(q)) return false
      if (filterSector && d.sector !== filterSector) return false
      if (filterStage && d.stage !== filterStage) return false
      return true
    })
  }, [deals, query, filterSector, filterStage])

  const columns = useMemo(() => {
    const grouped: Record<DealStatus, Deal[]> = {
      lead: [], due_diligence: [], term_sheet: [], closed_won: [], closed_lost: [],
    }
    for (const d of filtered) grouped[d.status].push(d)
    return grouped
  }, [filtered])

  // ─── إحصائيات ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = deals.length
    const active = deals.filter((d) => d.status !== 'closed_won' && d.status !== 'closed_lost').length
    const won = deals.filter((d) => d.status === 'closed_won').length
    const lost = deals.filter((d) => d.status === 'closed_lost').length
    const closed = won + lost
    const winRate = closed > 0 ? Math.round((won / closed) * 100) : null

    const pipelineValue = deals
      .filter((d) => d.status !== 'closed_lost')
      .reduce((s, d) => s + (Number(d.valuation) || 0), 0)
    const wonValue = deals
      .filter((d) => d.status === 'closed_won')
      .reduce((s, d) => s + (Number(d.valuation) || 0), 0)
    const avgTicket = deals.length > 0
      ? deals.reduce((s, d) => s + (Number(d.valuation) || 0), 0) / deals.length
      : 0
    return { total, active, won, lost, winRate, pipelineValue, wonValue, avgTicket }
  }, [deals])

  async function moveStatus(deal: Deal, next: DealStatus) {
    const previous = deal.status
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
        title="💼 خط أنابيب الصفقات"
        description="تنظيم صفقاتك من العميل المحتمل حتى الإغلاق — مع فلاتر ذكيّة وإحصائيات مباشرة."
        actions={
          <Button onClick={() => setShowAdd((v) => !v)} size="lg">
            {showAdd ? 'إغلاق' : '＋ صفقة جديدة'}
          </Button>
        }
      />

      {/* ─── إحصائيات ─────────────────────────────────────────── */}
      {deals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon="📊" label="إجمالي الصفقات" value={String(stats.total)} tint="sky" />
          <StatCard icon="🔄" label="صفقات نشطة"    value={String(stats.active)} tint="amber" />
          <StatCard icon="💰" label="قيمة الأنبوب"   value={SAR_FMT.format(stats.pipelineValue)} tint="primary" small />
          <StatCard icon="✅" label="صفقات مغلقة" value={`${stats.won} من ${stats.won + stats.lost}`} tint="emerald" />
          <StatCard icon="🎯" label="معدل الفوز"    value={stats.winRate != null ? `${stats.winRate}٪` : '—'} tint="violet" />
        </div>
      )}

      {/* ─── فلاتر + بحث ────────────────────────────────────── */}
      {deals.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔎 ابحث باسم الشركة…"
              className="min-w-[200px] flex-1"
            />
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">كل القطاعات</option>
              {SECTORS.map((s) => (
                <option key={s.code} value={s.code}>{s.icon} {s.label}</option>
              ))}
            </select>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">كل المراحل</option>
              {STAGES.map((s) => (
                <option key={s.code} value={s.code}>{s.icon} {s.label}</option>
              ))}
            </select>
            {(query || filterSector || filterStage) && (
              <Button
                size="sm" variant="outline"
                onClick={() => { setQuery(''); setFilterSector(''); setFilterStage('') }}
              >
                مسح الفلاتر ({filtered.length} من {deals.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showAdd && <AddDealForm onSubmit={onCreate} onCancel={() => setShowAdd(false)} />}

      {deals.length === 0 && !showAdd ? (
        <EmptyState
          title="لا توجد صفقات بعد"
          description="ابدأ بإضافة صفقتك الأولى — سنساعدك بقوائم قطاعات ومراحل جاهزة."
          icon={<span className="text-4xl">💼</span>}
          action={<Button onClick={() => setShowAdd(true)} size="lg">＋ إضافة صفقتك الأولى</Button>}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {DEAL_STATUS_ORDER.map((status) => {
            const items = columns[status]
            const colValue = items.reduce((s, d) => s + (Number(d.valuation) || 0), 0)
            return (
              <div key={status} className="flex flex-col gap-2">
                <div className={`rounded-lg border-2 border-b-0 px-3 py-2 text-xs font-semibold ${STATUS_TONE[status]}`}>
                  <div className="flex items-center justify-between">
                    <span>{STATUS_ICON[status]} {DEAL_STATUS_LABEL[status]}</span>
                    <span className="tabular-nums text-muted-foreground">({items.length})</span>
                  </div>
                  {colValue > 0 && (
                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground tabular-nums">
                      {SAR_FMT.format(colValue)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                      فارغ
                    </div>
                  )}
                  {items.map((d) => (
                    <DealCard key={d.id} deal={d} onMove={(s) => moveStatus(d, s)} onDelete={() => remove(d.id)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── مكوّنات فرعية ─────────────────────────────────────────────

function StatCard({
  icon, label, value, tint, small,
}: { icon: string; label: string; value: string; tint: 'sky' | 'amber' | 'emerald' | 'primary' | 'violet'; small?: boolean }) {
  const tintClass = {
    sky:     'border-sky-200 bg-sky-50/60',
    amber:   'border-amber-200 bg-amber-50/60',
    emerald: 'border-emerald-200 bg-emerald-50/60',
    primary: 'border-primary/30 bg-primary/5',
    violet:  'border-violet-200 bg-violet-50/60',
  }[tint]
  return (
    <div className={`rounded-xl border p-3 ${tintClass}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </div>
      <div className={`mt-1 font-bold tabular-nums ${small ? 'text-sm' : 'text-2xl'}`}>
        {value}
      </div>
    </div>
  )
}

function DealCard({
  deal, onMove, onDelete,
}: {
  deal: Deal
  onMove: (next: DealStatus) => void
  onDelete: () => void
}) {
  const s = sectorMeta(deal.sector)
  const st = stageMeta(deal.stage)
  return (
    <Card className="p-3 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium leading-snug">{deal.targetCompanyName}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {s && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-1.5 py-0 text-[10px]" title={s.label}>
                {s.icon} {s.label}
              </span>
            )}
            {st && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-primary/5 px-1.5 py-0 text-[10px]" title={`${st.label} · تذكرة نموذجية: ${st.typicalTicket}`}>
                {st.icon} {st.label}
              </span>
            )}
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
          {DEAL_STATUS_ORDER.map((sv) => (
            <option key={sv} value={sv}>{STATUS_ICON[sv]} {DEAL_STATUS_LABEL[sv]}</option>
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
  onSubmit, onCancel,
}: {
  onSubmit: (payload: { targetCompanyName: string; sector?: string; stage?: string; valuation?: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [stage, setStage] = useState('')
  const [valuation, setValuation] = useState('')

  const stageInfo = stageMeta(stage)

  function submit() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('اسم الشركة الهدف مطلوب')
      return
    }
    onSubmit({
      targetCompanyName: trimmedName,
      sector: sector || undefined,
      stage: stage || undefined,
      valuation: valuation.trim() ? Number(valuation) || undefined : undefined,
    })
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>＋ صفقة جديدة</CardTitle>
        <CardDescription>ابدأ بالعميل المحتمل — تقدر تعدّل الحالة والحقول لاحقاً.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="d_name">🏢 اسم الشركة الهدف *</Label>
          <Input id="d_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: شركة النمو للتقنية" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="d_sector">🏭 القطاع</Label>
          <select
            id="d_sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">اختر قطاعاً…</option>
            {SECTORS.map((s) => (
              <option key={s.code} value={s.code}>{s.icon} {s.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="d_stage">🚀 مرحلة الشركة</Label>
          <select
            id="d_stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">اختر مرحلة…</option>
            {STAGES.map((s) => (
              <option key={s.code} value={s.code}>{s.icon} {s.label} ({s.typicalTicket} SAR)</option>
            ))}
          </select>
          {stageInfo && (
            <p className="text-[10px] text-muted-foreground">
              تذكرة نموذجية للمرحلة: <span className="font-semibold">{stageInfo.typicalTicket} SAR</span>
            </p>
          )}
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="d_val">💰 التقييم المتوقّع (SAR)</Label>
          <Input
            id="d_val" type="number" value={valuation}
            onChange={(e) => setValuation(e.target.value)}
            placeholder="5000000"
          />
          {valuation && !isNaN(Number(valuation)) && Number(valuation) > 0 && (
            <p className="text-[10px] text-primary">
              = {SAR_FMT.format(Number(valuation))}
            </p>
          )}
        </div>

        <div className="col-span-full flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>إلغاء</Button>
          <Button onClick={submit} disabled={!name.trim()}>＋ إضافة الصفقة</Button>
        </div>
      </CardContent>
    </Card>
  )
}
