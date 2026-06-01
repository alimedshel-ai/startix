import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aiSimulate, type SimulationResult } from '@/lib/aiApi'
import { apiErrorMessage } from '@/lib/api'

interface Inputs {
  baseRevenue: number
  baseCost: number
  investment: number
  revenueGrowthPct: number
  costReductionPct: number
}

const DEFAULTS: Inputs = {
  baseRevenue: 3_000_000,
  baseCost:    2_400_000,
  investment:    500_000,
  revenueGrowthPct: 20,
  costReductionPct: 10,
}

const SAR = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })

function compute(i: Inputs): SimulationResult {
  const projectedRevenue = i.baseRevenue * (1 + i.revenueGrowthPct / 100)
  const projectedCost    = i.baseCost * (1 - i.costReductionPct / 100)
  const currentProfit    = i.baseRevenue - i.baseCost
  const projectedProfit  = projectedRevenue - projectedCost
  const netBenefit       = projectedProfit - currentProfit
  const roi              = i.investment > 0 ? netBenefit / i.investment : 0
  const paybackMonths    = netBenefit > 0 ? i.investment / (netBenefit / 12) : null
  return { projectedRevenue, projectedCost, netBenefit, roi, paybackMonths }
}

function roiTint(roi: number): { tint: string; label: string } {
  if (roi >= 0.5)  return { tint: 'border-emerald-300 bg-emerald-50/60', label: 'ممتاز' }
  if (roi >= 0.2)  return { tint: 'border-sky-300 bg-sky-50/60',         label: 'جيد' }
  if (roi >= 0)    return { tint: 'border-amber-300 bg-amber-50/60',     label: 'هامشي' }
  return { tint: 'border-rose-300 bg-rose-50/60', label: 'خاسر' }
}

export function SimulationLabPage() {
  return (
    <StrategicShell
      title="مختبر المحاكاة"
      description="سيناريوهات ماذا-لو: اضبط المعدلات، النتائج تُحسب فوراً. Claude يحلل الجدوى."
    >
      {(companyId) => <Lab companyId={companyId} />}
    </StrategicShell>
  )
}

function Lab({ companyId }: { companyId: string }) {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  const result = useMemo(() => compute(inputs), [inputs])
  const roi = roiTint(result.roi)

  function set<K extends keyof Inputs>(k: K, v: number) {
    setInputs((p) => ({ ...p, [k]: v }))
  }

  async function askAI() {
    setLoadingAi(true)
    setNarrative(null)
    try {
      const res = await aiSimulate({ companyId, ...inputs })
      setNarrative(res.narrative ?? null)
      if (!res.narrative) toast.message('Claude لم يضف تحليلاً (مفتاح API غير مضبوط؟)')
      else toast.success('تم توليد التحليل')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحليل'))
    } finally {
      setLoadingAi(false)
    }
  }

  function reset() {
    setInputs(DEFAULTS)
    setNarrative(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle>المدخلات</CardTitle>
          <CardDescription>كل القيم بالريال السعودي. النتائج تُحدّث فوراً.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="baseRev">إيراد سنوي حالي</Label>
              <Input id="baseRev" type="number" value={inputs.baseRevenue} onChange={(e) => set('baseRevenue', Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseCost">تكلفة سنوية حالية</Label>
              <Input id="baseCost" type="number" value={inputs.baseCost} onChange={(e) => set('baseCost', Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="inv">الاستثمار المطلوب</Label>
              <Input id="inv" type="number" value={inputs.investment} onChange={(e) => set('investment', Number(e.target.value) || 0)} />
            </div>
          </div>

          <SliderField
            label="نمو الإيراد (%)"
            value={inputs.revenueGrowthPct}
            min={-50}
            max={200}
            accent="emerald"
            onChange={(v) => set('revenueGrowthPct', v)}
          />
          <SliderField
            label="تخفيض التكلفة (%)"
            value={inputs.costReductionPct}
            min={-30}
            max={60}
            accent="sky"
            onChange={(v) => set('costReductionPct', v)}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset}>إعادة الضبط</Button>
            <Button onClick={askAI} disabled={loadingAi}>
              {loadingAi ? 'جاري التحليل…' : '🤖 اطلب تحليل Claude'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className={`${roi.tint} overflow-hidden`}>
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
          <CardHeader>
            <CardDescription>العائد على الاستثمار</CardDescription>
            <CardTitle className="text-4xl tabular-nums">
              {Number.isFinite(result.roi) ? `${(result.roi * 100).toFixed(1)}%` : '—'}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({roi.label})</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="إيراد متوقع" value={SAR.format(result.projectedRevenue)} accent="emerald" />
          <Stat label="تكلفة متوقعة" value={SAR.format(result.projectedCost)} accent="sky" />
          <Stat label="صافي الفائدة" value={SAR.format(result.netBenefit)} accent={result.netBenefit >= 0 ? 'emerald' : 'rose'} />
        </div>

        <Card className="border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent">
          <CardHeader>
            <CardDescription>الاسترداد المتوقع</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {result.paybackMonths == null
                ? 'غير قابل'
                : `${result.paybackMonths.toFixed(1)} شهر`}
            </CardTitle>
          </CardHeader>
        </Card>

        {narrative && (
          <Card className="border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>🤖</span>
                تحليل Claude
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{narrative}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function SliderField({
  label, value, min, max, accent, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  accent: 'emerald' | 'sky'
  onChange: (v: number) => void
}) {
  const accentClass = accent === 'emerald' ? 'accent-emerald-600' : 'accent-sky-600'
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-semibold">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`mt-1 w-full ${accentClass}`}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'sky' | 'rose' }) {
  const palette = {
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-700',
    sky:     'border-sky-200 bg-sky-50/60 text-sky-700',
    rose:    'border-rose-200 bg-rose-50/60 text-rose-700',
  }[accent]
  return (
    <Card className={palette}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-lg tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
