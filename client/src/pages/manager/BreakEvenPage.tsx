import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Inputs {
  fixedCosts: number
  pricePerUnit: number
  variableCostPerUnit: number
  monthlyVolume: number
}

const DEFAULTS: Inputs = {
  fixedCosts: 100_000,
  pricePerUnit: 250,
  variableCostPerUnit: 100,
  monthlyVolume: 800,
}

function formatSAR(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value)
}

export function BreakEvenPage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS)

  const result = useMemo(() => {
    const contribution = inputs.pricePerUnit - inputs.variableCostPerUnit
    const cmRatio = inputs.pricePerUnit === 0 ? 0 : contribution / inputs.pricePerUnit
    const beUnits = contribution <= 0 ? Infinity : Math.ceil(inputs.fixedCosts / contribution)
    const beRevenue = beUnits === Infinity ? Infinity : beUnits * inputs.pricePerUnit
    const monthsToBE = inputs.monthlyVolume <= 0 || beUnits === Infinity ? Infinity : Math.ceil(beUnits / inputs.monthlyVolume)
    const projectedProfit = inputs.monthlyVolume * contribution - inputs.fixedCosts
    return { contribution, cmRatio, beUnits, beRevenue, monthsToBE, projectedProfit }
  }, [inputs])

  function bind<K extends keyof Inputs>(key: K) {
    return {
      value: inputs[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setInputs((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 })),
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حاسبة نقطة التعادل"
        description="تحليل الربحية: كم وحدة، وعلى أي مدى زمني، حتى تصل الأعمال إلى نقطة التعادل."
        breadcrumbs={[
          { label: 'الأقسام', to: '/manager/select-dept' },
          { label: 'المالية', to: '/manager/finance/audit' },
          { label: 'نقطة التعادل' },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-200">
          <CardHeader>
            <CardTitle>المدخلات</CardTitle>
            <CardDescription>الأرقام الشهرية بالريال السعودي.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fc">التكاليف الثابتة / شهر</Label>
              <Input id="fc" type="number" {...bind('fixedCosts')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu">سعر الوحدة</Label>
              <Input id="pu" type="number" {...bind('pricePerUnit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vc">التكلفة المتغيرة للوحدة</Label>
              <Input id="vc" type="number" {...bind('variableCostPerUnit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mv">الحجم الشهري (وحدات)</Label>
              <Input id="mv" type="number" {...bind('monthlyVolume')} />
            </div>
            <Button variant="outline" onClick={() => setInputs(DEFAULTS)}>إعادة تعيين</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-200">
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-amber-500" />
          <CardHeader>
            <CardTitle>النتيجة</CardTitle>
            <CardDescription>تتحدّث مع تغيير المدخلات.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="هامش المساهمة / وحدة" value={formatSAR(result.contribution)} />
            <Row label="نسبة المساهمة" value={`${Math.round(result.cmRatio * 100)}%`} />
            <Row
              label="وحدات نقطة التعادل"
              value={Number.isFinite(result.beUnits) ? result.beUnits.toLocaleString() : '∞ (السعر ≤ التكلفة المتغيرة)'}
            />
            <Row
              label="إيرادات نقطة التعادل"
              value={Number.isFinite(result.beRevenue) ? formatSAR(result.beRevenue) : '—'}
            />
            <Row
              label="أشهر للوصول لنقطة التعادل"
              value={Number.isFinite(result.monthsToBE) ? `${result.monthsToBE} شهر` : '—'}
            />
            <Row label="الربح الشهري المتوقع" value={formatSAR(result.projectedProfit)} highlight />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-200">
        <CardHeader>
          <CardTitle>صحة السيولة</CardTitle>
          <CardDescription>كم هي مريحة المدة الزمنية عند هامش المساهمة هذا؟</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {result.contribution <= 0 && (
            <p className="text-red-700">هامش مساهمة سالب — كل وحدة تُباع تُكبّد خسارة. ارفع السعر أو خفّض التكلفة المتغيرة.</p>
          )}
          {result.contribution > 0 && result.projectedProfit < 0 && (
            <p className="text-orange-700">
              أقل من نقطة التعادل عند الحجم الحالي. يجب أن ينمو الحجم{' '}
              <span className="tabular-nums">{Math.max(0, Math.ceil((Math.abs(result.projectedProfit) + 1) / result.contribution)).toLocaleString()}</span> وحدة/شهر للوصول إلى الصفر.
            </p>
          )}
          {result.projectedProfit >= 0 && (
            <p className="text-emerald-700">مربح عند الحجم الحالي. احتفظ بـ {formatSAR(inputs.fixedCosts * 3)} (تكاليف ثابتة لـ 3 أشهر) كاحتياطي نقدي.</p>
          )}
        </CardContent>
      </Card>
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
