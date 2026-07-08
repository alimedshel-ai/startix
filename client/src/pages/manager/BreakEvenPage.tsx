import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { getMyFirstCompany, type Company } from '@/lib/deptApi'
import {
  createBreakEven,
  getLatestBreakEven,
  type BreakEven,
  type BreakEvenResult,
  type BreakEvenSeverity,
} from '@/lib/financeApi'

interface Inputs {
  fixedCosts: number
  pricePerUnit: number
  variableCostPerUnit: number
  currentRevenue: number
}

const DEFAULTS: Inputs = {
  fixedCosts: 100_000,
  pricePerUnit: 250,
  variableCostPerUnit: 100,
  currentRevenue: 500_000,
}

function formatSAR(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString('ar-SA')
}

// معاينة العميل الحية — نفس منطق السيرفر لتفادي انتظار الشبكة أثناء الكتابة.
// عند الضغط على "احسب واحفظ" يُعتمَد ردّ السيرفر بديلاً موثّقاً.
function previewLocal(i: Inputs): Partial<BreakEvenResult> {
  const cm = i.pricePerUnit - i.variableCostPerUnit
  const cmPct = i.pricePerUnit > 0 ? (cm / i.pricePerUnit) * 100 : null
  const beUnits = cm > 0 ? Math.ceil(i.fixedCosts / cm) : null
  const beRevenue = beUnits !== null ? beUnits * i.pricePerUnit : null
  const safetyPct = beRevenue !== null && i.currentRevenue > 0
    ? ((i.currentRevenue - beRevenue) / i.currentRevenue) * 100
    : null
  return { contributionMargin: cm, contributionMarginPct: cmPct, breakEvenUnits: beUnits, breakEvenRevenue: beRevenue, safetyMarginPct: safetyPct }
}

const SEVERITY_TONE: Record<BreakEvenSeverity, string> = {
  GOOD:     'border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200',
  WARNING:  'border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200',
  CRITICAL: 'border-rose-500/40 bg-rose-500/5 text-rose-800 dark:text-rose-200',
}

const SEVERITY_ICON: Record<BreakEvenSeverity, string> = {
  GOOD: '✅',
  WARNING: '⚠️',
  CRITICAL: '🔴',
}

export function BreakEvenPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS)
  const [savedResult, setSavedResult] = useState<BreakEvenResult | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company: co } = await getMyFirstCompany()
        if (cancel || !co) return
        setCompany(co)
        const latest: BreakEven | null = await getLatestBreakEven(co.id)
        if (cancel || !latest) return
        setInputs({
          fixedCosts: latest.fixedCosts,
          pricePerUnit: latest.pricePerUnit,
          variableCostPerUnit: latest.variableCostPerUnit,
          currentRevenue: latest.currentRevenue ?? DEFAULTS.currentRevenue,
        })
        setSavedResult(latest.result)
        setSavedAt(latest.createdAt)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل آخر حساب محفوظ'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  const preview = useMemo(() => previewLocal(inputs), [inputs])

  function bind<K extends keyof Inputs>(key: K) {
    return {
      value: Number.isFinite(inputs[key]) ? inputs[key] : 0,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputs((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 })),
    }
  }

  async function saveNow() {
    if (!company) return
    setSaving(true)
    try {
      const row = await createBreakEven({
        companyId: company.id,
        fixedCosts: inputs.fixedCosts,
        pricePerUnit: inputs.pricePerUnit,
        variableCostPerUnit: inputs.variableCostPerUnit,
        currentRevenue: inputs.currentRevenue > 0 ? inputs.currentRevenue : undefined,
      })
      setSavedResult(row.result)
      setSavedAt(row.createdAt)
      toast.success('تم حفظ حساب نقطة التعادل')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="حاسبة نقطة التعادل" />
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="حاسبة نقطة التعادل" />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          description="أنشئ شركة أوّلاً من لوحة القيادة لتحفظ حسابات نقطة التعادل."
          icon={<span className="text-4xl">🏢</span>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حاسبة نقطة التعادل"
        description={savedAt
          ? `آخر حفظ: ${new Date(savedAt).toLocaleString('ar-SA')}`
          : 'حاسبة ربحية — احسب نقطة التعادل واحفظها لتتبّع تطوّرها عبر الزمن.'}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-200">
          <CardHeader>
            <CardTitle>المدخلات</CardTitle>
            <CardDescription>الأرقام السنوية بالريال السعودي.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fc">التكاليف الثابتة</Label>
              <Input id="fc" type="number" {...bind('fixedCosts')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu">سعر الوحدة</Label>
              <Input id="pu" type="number" {...bind('pricePerUnit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vc">التكلفة المتغيّرة للوحدة</Label>
              <Input id="vc" type="number" {...bind('variableCostPerUnit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cr">الإيراد الحالي (اختياري — لحساب هامش الأمان)</Label>
              <Input id="cr" type="number" {...bind('currentRevenue')} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveNow} disabled={saving}>
                {saving ? 'جاري الحفظ…' : 'احسب واحفظ'}
              </Button>
              <Button variant="outline" onClick={() => setInputs(DEFAULTS)}>إعادة تعيين</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-200">
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-amber-500" />
          <CardHeader>
            <CardTitle>معاينة النتيجة</CardTitle>
            <CardDescription>تتحدّث مع تغيير المدخلات — اضغط "احسب واحفظ" لتوثيقها.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="هامش المساهمة / وحدة" value={formatSAR(preview.contributionMargin ?? null)} />
            <Row label="نسبة المساهمة" value={preview.contributionMarginPct !== null && preview.contributionMarginPct !== undefined ? `${Math.round(preview.contributionMarginPct)}%` : '—'} />
            <Row label="وحدات نقطة التعادل" value={formatNumber(preview.breakEvenUnits ?? null)} />
            <Row label="إيرادات نقطة التعادل" value={formatSAR(preview.breakEvenRevenue ?? null)} />
            <Row label="هامش الأمان" value={preview.safetyMarginPct !== null && preview.safetyMarginPct !== undefined ? `${Math.round(preview.safetyMarginPct)}%` : '—'} highlight />
          </CardContent>
        </Card>
      </div>

      {savedResult && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-l from-primary via-violet-500 to-emerald-500" />
          <CardHeader>
            <CardTitle>{savedResult.headline}</CardTitle>
            <CardDescription>نتيجة محسوبة ومحفوظة على السيرفر لآخر إدخال.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedResult.insights.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد ملاحظات إضافية.</p>
            )}
            {savedResult.insights.map((ins, i) => (
              <div key={i} className={`rounded-xl border p-3 text-sm ${SEVERITY_TONE[ins.severity]}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none">{SEVERITY_ICON[ins.severity]}</span>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-snug">{ins.message}</p>
                    {ins.action && <p className="text-xs opacity-90">{ins.action}</p>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b pb-2 ${highlight ? 'text-base font-semibold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
