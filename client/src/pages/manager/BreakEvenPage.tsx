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
        title="Break-even calculator"
        description="Profitability analysis: how many units, and over what runway, until the business breaks even."
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: 'Finance', to: '/manager/finance/audit' },
          { label: 'Break-even' },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Monthly figures in SAR.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fc">Fixed costs / month</Label>
              <Input id="fc" type="number" {...bind('fixedCosts')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu">Price per unit</Label>
              <Input id="pu" type="number" {...bind('pricePerUnit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vc">Variable cost per unit</Label>
              <Input id="vc" type="number" {...bind('variableCostPerUnit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mv">Monthly volume (units)</Label>
              <Input id="mv" type="number" {...bind('monthlyVolume')} />
            </div>
            <Button variant="outline" onClick={() => setInputs(DEFAULTS)}>Reset</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Updates as you change inputs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Contribution margin / unit" value={formatSAR(result.contribution)} />
            <Row label="Contribution ratio" value={`${Math.round(result.cmRatio * 100)}%`} />
            <Row
              label="Break-even units"
              value={Number.isFinite(result.beUnits) ? result.beUnits.toLocaleString() : '∞ (price ≤ variable cost)'}
            />
            <Row
              label="Break-even revenue"
              value={Number.isFinite(result.beRevenue) ? formatSAR(result.beRevenue) : '—'}
            />
            <Row
              label="Months to break-even"
              value={Number.isFinite(result.monthsToBE) ? `${result.monthsToBE} months` : '—'}
            />
            <Row label="Projected monthly profit" value={formatSAR(result.projectedProfit)} highlight />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liquidity health</CardTitle>
          <CardDescription>How comfortable is the runway at this contribution margin?</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {result.contribution <= 0 && (
            <p className="text-red-700">Negative contribution — every unit sold loses money. Raise price or cut variable cost.</p>
          )}
          {result.contribution > 0 && result.projectedProfit < 0 && (
            <p className="text-orange-700">
              Below break-even at the current volume. Volume must grow{' '}
              {Math.max(0, Math.ceil((Math.abs(result.projectedProfit) + 1) / result.contribution)).toLocaleString()} units/month to reach zero.
            </p>
          )}
          {result.projectedProfit >= 0 && (
            <p className="text-emerald-700">Profitable at current volume. Reserve {formatSAR(inputs.fixedCosts * 3)} (3 months fixed costs) as a cash cushion.</p>
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
      <span>{value}</span>
    </div>
  )
}
