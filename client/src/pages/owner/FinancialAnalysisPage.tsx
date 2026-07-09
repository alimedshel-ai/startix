import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { OpexHint } from '@/components/OpexHint'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import type { Company } from '@/lib/deptApi'
import {
  createDupont,
  createMonteCarloRun,
  getLatestDupont,
  getLatestMonteCarloRun,
  type DupontAnalysis,
  type MonteCarloRun,
  type TriangularDist,
} from '@/lib/financeApi'

// ─── C13 — تحليل Dupont + محاكاة Monte Carlo ─────────────────────────────────
// صفحة تحليل مالي متقدّم لصاحب الشركة. كل الحسابات على السيرفر — لا localStorage.

const SAR_FMT = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })
const PCT_FMT = (n: number, d = 1) => `${(n * 100).toLocaleString('ar-SA', { maximumFractionDigits: d })}%`
const NUM_FMT = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 })

export function FinancialAnalysisPage() {
  return (
    <ErrorBoundary>
      <FinancialAnalysisContent />
    </ErrorBoundary>
  )
}

function FinancialAnalysisContent() {
  // R4.4 — نستهلك useCompany حتى يفتح المدير المستقل الأداة عبر ?client=X.
  // نبقي الحالة الداخلية `company` لتوافق مع الاستخدامات السفلية بلا تغيير شامل.
  const scope = useCompany()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [dupont, setDupont] = useState<DupontAnalysis | null>(null)
  const [mc, setMc] = useState<MonteCarloRun | null>(null)

  useEffect(() => {
    let cancel = false
    if (scope.loading) return
    const co = scope.company
    if (!co) {
      setLoading(false)
      return
    }
    setCompany(co)
    ;(async () => {
      try {
        const [d, m] = await Promise.allSettled([
          getLatestDupont(co.id),
          getLatestMonteCarloRun(co.id),
        ])
        if (cancel) return
        if (d.status === 'fulfilled') setDupont(d.value)
        if (m.status === 'fulfilled') setMc(m.value)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل التحليلات المالية'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [scope.loading, scope.company])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التحليل المالي المتقدّم" />
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التحليل المالي المتقدّم" />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          description="أنشئ شركة من لوحة القيادة لتشغيل تحليل Dupont ومحاكاة Monte Carlo."
          icon={<span className="text-4xl">🏢</span>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="التحليل المالي المتقدّم"
        description="تحليل Dupont لتحديد محرّكات ROE + محاكاة Monte Carlo لتوقّع توزيع الأرباح."
      />

      <OpexHint opex={company.opex} focus={['budget', 'target', 'avgSalary']} title="أرقام تشغيلية مغذّية لبنود التحليل" />

      <DupontCard companyId={company.id} initial={dupont} onSaved={setDupont} />
      <MonteCarloCard companyId={company.id} initial={mc} onSaved={setMc} />
    </div>
  )
}

// ─── Dupont ────────────────────────────────────────────────────────────────

interface DupontDraft {
  netIncome: number
  revenue: number
  totalAssets: number
  equity: number
}

const DUPONT_DEFAULTS: DupontDraft = {
  netIncome: 150_000,
  revenue: 1_000_000,
  totalAssets: 800_000,
  equity: 400_000,
}

function DupontCard({
  companyId,
  initial,
  onSaved,
}: {
  companyId: string
  initial: DupontAnalysis | null
  onSaved: (d: DupontAnalysis) => void
}) {
  // ملاحظة: النموذج يخزّن العوامل الثلاثة الناتجة فقط — لا الأرقام الخام.
  // نبدأ من الافتراضات ثم نُحدَّث بعد الحفظ الأول.
  const [draft, setDraft] = useState<DupontDraft>(DUPONT_DEFAULTS)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const row = await createDupont({ companyId, ...draft })
      onSaved(row)
      toast.success('تم حفظ تحليل Dupont')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر حفظ Dupont'))
    } finally {
      setSaving(false)
    }
  }

  function bind<K extends keyof DupontDraft>(key: K) {
    return {
      value: Number.isFinite(draft[key]) ? draft[key] : 0,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 })),
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-sky-500 via-blue-500 to-indigo-500" />
      <CardHeader>
        <CardTitle>تحليل Dupont — تفكيك ROE</CardTitle>
        <CardDescription>
          ROE = هامش الربح × دوران الأصول × مضاعف حقوق الملكية.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="d_ni">صافي الربح (سنوي)</Label>
            <Input id="d_ni" type="number" {...bind('netIncome')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d_rev">الإيراد (سنوي)</Label>
            <Input id="d_rev" type="number" {...bind('revenue')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d_ta">إجمالي الأصول</Label>
            <Input id="d_ta" type="number" {...bind('totalAssets')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d_eq">حقوق الملكية</Label>
            <Input id="d_eq" type="number" {...bind('equity')} />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'جاري الحساب…' : 'احسب واحفظ'}
          </Button>
        </div>

        {initial ? (
          <div className="space-y-3">
            <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
              <div className="text-xs text-muted-foreground">العائد على حقوق الملكية (ROE)</div>
              <div className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {PCT_FMT(initial.roe, 2)}
              </div>
            </div>
            <FactorRow label="هامش الربح" value={PCT_FMT(initial.netMargin, 2)} />
            <FactorRow label="دوران الأصول" value={NUM_FMT.format(initial.assetTurnover)} suffix="×" />
            <FactorRow label="مضاعف حقوق الملكية" value={NUM_FMT.format(initial.equityMultiplier)} suffix="×" />
            <p className="text-xs text-muted-foreground">
              آخر حفظ: {new Date(initial.createdAt).toLocaleString('ar-SA')}
            </p>
          </div>
        ) : (
          <EmptyState
            title="لم يُحفظ تحليل Dupont بعد"
            description="اضغط «احسب واحفظ» لأول مرة."
            icon={<span className="text-4xl">📐</span>}
          />
        )}
      </CardContent>
    </Card>
  )
}

function FactorRow({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}{suffix ? ` ${suffix}` : ''}</span>
    </div>
  )
}

// ─── Monte Carlo ──────────────────────────────────────────────────────────

interface MonteCarloDraft {
  revenue: TriangularDist
  variableCostPct: TriangularDist
  fixedCosts: TriangularDist
  iterations: number
}

const MC_DEFAULTS: MonteCarloDraft = {
  revenue: { min: 800_000, likely: 1_200_000, max: 1_600_000 },
  variableCostPct: { min: 0.35, likely: 0.42, max: 0.55 },
  fixedCosts: { min: 400_000, likely: 500_000, max: 650_000 },
  iterations: 10_000,
}

function MonteCarloCard({
  companyId,
  initial,
  onSaved,
}: {
  companyId: string
  initial: MonteCarloRun | null
  onSaved: (r: MonteCarloRun) => void
}) {
  const [draft, setDraft] = useState<MonteCarloDraft>(() =>
    initial ? {
      revenue: initial.inputs.revenue,
      variableCostPct: initial.inputs.variableCostPct,
      fixedCosts: initial.inputs.fixedCosts,
      iterations: initial.iterations,
    } : MC_DEFAULTS
  )
  const [running, setRunning] = useState(false)

  function bind(field: 'revenue' | 'variableCostPct' | 'fixedCosts', key: keyof TriangularDist) {
    return {
      value: Number.isFinite(draft[field][key]) ? draft[field][key] : 0,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((prev) => ({
          ...prev,
          [field]: { ...prev[field], [key]: Number(e.target.value) || 0 },
        })),
    }
  }

  async function run() {
    setRunning(true)
    try {
      const row = await createMonteCarloRun({ companyId, ...draft })
      onSaved(row)
      toast.success(`اكتملت ${row.iterations.toLocaleString('ar-SA')} محاكاة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر تشغيل المحاكاة'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
      <CardHeader>
        <CardTitle>محاكاة Monte Carlo — توزيع الربح المتوقّع</CardTitle>
        <CardDescription>
          توزيع مثلثي لكل متغيّر (min / likely / max) · نموذج ربح =
          الإيراد × (1 − نسبة التكاليف المتغيّرة) − التكاليف الثابتة.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <TriangularRow label="الإيراد" field="revenue" bind={bind} />
          <TriangularRow label="نسبة التكاليف المتغيّرة (0–1)" field="variableCostPct" bind={bind} step="0.01" />
          <TriangularRow label="التكاليف الثابتة" field="fixedCosts" bind={bind} />
          <div className="space-y-1">
            <Label htmlFor="mc_iter">عدد التكرارات (100 – 50,000)</Label>
            <Input
              id="mc_iter"
              type="number"
              value={draft.iterations}
              onChange={(e) => setDraft((p) => ({ ...p, iterations: Number(e.target.value) || 0 }))}
            />
          </div>
          <Button onClick={run} disabled={running}>
            {running ? 'جاري المحاكاة…' : 'شغّل المحاكاة'}
          </Button>
        </div>

        {initial ? (
          <div className="space-y-3">
            <div className="rounded-2xl border bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-4">
              <div className="text-xs text-muted-foreground">متوسط الربح المتوقّع</div>
              <div className="text-3xl font-bold tabular-nums">{SAR_FMT.format(initial.results.mean)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                بناءً على {initial.results.iterations.toLocaleString('ar-SA')} محاكاة
              </div>
            </div>
            <FactorRow label="مئين 10% (سيناريو متشائم)" value={SAR_FMT.format(initial.results.p10)} />
            <FactorRow label="مئين 50% (السيناريو الوسط)" value={SAR_FMT.format(initial.results.p50)} />
            <FactorRow label="مئين 90% (سيناريو متفائل)" value={SAR_FMT.format(initial.results.p90)} />
            <div className={`rounded-lg border px-3 py-2 text-sm ${
              initial.results.probLoss > 0.25
                ? 'border-rose-500/40 bg-rose-500/5 text-rose-800'
                : initial.results.probLoss > 0.1
                  ? 'border-amber-500/40 bg-amber-500/5 text-amber-800'
                  : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-800'
            }`}>
              احتمالية الخسارة (ربح &lt; 0): <span className="tabular-nums font-semibold">{PCT_FMT(initial.results.probLoss, 1)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              آخر تشغيل: {new Date(initial.createdAt).toLocaleString('ar-SA')}
            </p>
          </div>
        ) : (
          <EmptyState
            title="لم يُشغَّل أي محاكاة بعد"
            description="اضغط «شغّل المحاكاة» لتوليد التوزيع الأول."
            icon={<span className="text-4xl">🎲</span>}
          />
        )}
      </CardContent>
    </Card>
  )
}

function TriangularRow({
  label,
  field,
  bind,
  step,
}: {
  label: string
  field: 'revenue' | 'variableCostPct' | 'fixedCosts'
  bind: (f: 'revenue' | 'variableCostPct' | 'fixedCosts', k: keyof TriangularDist) => { value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }
  step?: string
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <LabeledInput id={`${field}_min`} label="min" step={step} {...bind(field, 'min')} />
        <LabeledInput id={`${field}_likely`} label="likely" step={step} {...bind(field, 'likely')} />
        <LabeledInput id={`${field}_max`} label="max" step={step} {...bind(field, 'max')} />
      </div>
    </div>
  )
}

function LabeledInput({
  id,
  label,
  step,
  value,
  onChange,
}: {
  id: string
  label: string
  step?: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Input id={id} type="number" step={step} value={value} onChange={onChange} />
    </div>
  )
}
