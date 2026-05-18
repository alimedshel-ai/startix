import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  dangerZoneColor,
  getComplianceQuestions,
  getMyFirstCompany,
  submitCompliancePro,
  type ComplianceProResult,
} from '@/lib/deptApi'

interface ProQuestion {
  id: string
  axis: string
  prompt: string
  options: { value: string; label: string }[]
}

interface ProAxisDef {
  key: string
  label: string
  regulator: string
  mandatory: boolean
}

interface KOLicense {
  key: string
  label: string
  axis: string
}

const PENALTY_FMT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })

export function ComplianceAuditProPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [axes, setAxes] = useState<ProAxisDef[]>([])
  const [questions, setQuestions] = useState<ProQuestion[]>([])
  const [koDefs, setKoDefs] = useState<KOLicense[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [koDates, setKoDates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ComplianceProResult | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (!company) {
          toast.error('Complete the manager diagnostic first')
          setLoading(false)
          return
        }
        setCompanyId(company.id)
        const data = await getComplianceQuestions(company.id, 'pro')
        if (cancel) return
        setAxes(data.axes ?? [])
        setQuestions(data.questions ?? [])
        setKoDefs(data.koLicenses ?? [])
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load Pro audit'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, ProQuestion[]> = {}
    for (const q of questions) (map[q.axis] ??= []).push(q)
    return map
  }, [questions])

  const answeredCount = Object.keys(answers).length
  const progress = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100)

  async function submit() {
    if (!companyId) return
    if (answeredCount < questions.length) {
      toast.error(`Please answer all ${questions.length} questions before submitting.`)
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, v]) => ({ questionId, value: v })),
        koLicenses: Object.entries(koDates).map(([key, v]) => ({ key, expiresAt: v || null })),
      }
      const { result } = await submitCompliancePro(companyId, payload)
      setResult(result)
      toast.success('Pro audit submitted')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not submit audit'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compliance audit (Pro)"
        description="64 mandatory elements across 8 axes + sector-specific axes. KO licenses force the axis to 0 when expired."
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: 'Compliance', to: '/manager/compliance/audit' },
          { label: 'Pro' },
        ]}
        actions={
          <Link to="/manager/compliance/audit" className={buttonVariants({ variant: 'outline' })}>
            Back to basic
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading Pro audit…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>{answeredCount} of {questions.length} answered.</CardDescription>
              <Progress value={progress} className="mt-2" />
            </CardHeader>
          </Card>

          {koDefs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Smart KO — licenses & expiry dates</CardTitle>
                <CardDescription>Expired licenses force the axis to 0 and trigger a penalty. Warnings at 30 and 90 days.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {koDefs.map((lic) => (
                  <div key={lic.key} className="space-y-1">
                    <Label htmlFor={`ko_${lic.key}`}>{lic.label}</Label>
                    <Input
                      id={`ko_${lic.key}`}
                      type="date"
                      value={koDates[lic.key] ?? ''}
                      onChange={(e) => setKoDates((prev) => ({ ...prev, [lic.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {axes.map((axis) => {
            const qs = grouped[axis.key] ?? []
            if (qs.length === 0) return null
            return (
              <Card key={axis.key}>
                <CardHeader>
                  <CardTitle>{axis.label}</CardTitle>
                  <CardDescription>Regulator: {axis.regulator} · {qs.length} questions · {axis.mandatory ? 'Mandatory axis' : 'Sector-contextual'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qs.map((q) => (
                    <div key={q.id} className="space-y-2 border-b pb-3 last:border-b-0">
                      <p className="text-sm font-medium">{q.prompt}</p>
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: String(v) }))}
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                      >
                        {q.options.map((opt) => (
                          <Label
                            key={opt.value}
                            htmlFor={`${q.id}_${opt.value}`}
                            className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs hover:bg-accent"
                          >
                            <RadioGroupItem value={opt.value} id={`${q.id}_${opt.value}`} />
                            <span>{opt.label}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          <CardFooter className="justify-end">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : `Submit (${answeredCount}/${questions.length})`}
            </Button>
          </CardFooter>
        </>
      )}

      {result && <ProResultView result={result} />}
    </div>
  )
}

function ProResultView({ result }: { result: ComplianceProResult }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Overall maturity</CardTitle>
          <CardDescription>{result.dangerZone === 'RED' ? 'Critical exposure across multiple axes.' : 'See per-axis breakdown below.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-semibold">{result.overallMaturityPct}%</div>
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${dangerZoneColor(result.dangerZone)}`}>{result.dangerZone} zone</span>
          </div>
          <Progress value={result.overallMaturityPct} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-axis maturity</CardTitle>
          <CardDescription>Mandatory axes appear first.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {result.axes.map((a) => (
              <div key={a.axis} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.regulator}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(a.dangerZone)}`}>{a.dangerZone}</span>
                </div>
                <div className="mt-2 text-xl font-semibold">{a.maturityPct}%</div>
                <Progress value={a.maturityPct} className="mt-1 h-1.5" />
                {a.warnings.length > 0 && (
                  <ul className="mt-2 text-xs text-orange-700">
                    {a.warnings.map((w) => (
                      <li key={w}>• {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk matrix</CardTitle>
          <CardDescription>Top 8 axes ordered by lowest maturity.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Axis</th>
                <th className="py-2">P</th>
                <th className="py-2">I</th>
                <th className="py-2">Risk</th>
                <th className="py-2">Top risk identified</th>
              </tr>
            </thead>
            <tbody>
              {result.riskMatrix.map((row) => (
                <tr key={row.axis} className="border-b">
                  <td className="py-2 font-medium">{row.label}</td>
                  <td className="py-2">{row.probability}</td>
                  <td className="py-2">{row.impact}</td>
                  <td className="py-2 font-semibold">{row.risk}</td>
                  <td className="py-2 text-muted-foreground">{row.topRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saudi penalty exposure</CardTitle>
          <CardDescription>Estimate scaled by axis weights and maturity gaps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between border-b pb-2">
            <span className="text-muted-foreground">Max penalty (entity ceiling)</span>
            <span className="font-medium">{PENALTY_FMT.format(result.penaltyEstimate.maxPenalty)}</span>
          </div>
          <div className="flex items-baseline justify-between border-b pb-2">
            <span className="text-muted-foreground">Estimated exposure</span>
            <span className="text-lg font-semibold text-red-700">{PENALTY_FMT.format(result.penaltyEstimate.estimate)}</span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {result.penaltyEstimate.perAxis.map((p) => (
              <li key={p.axis} className="flex justify-between">
                <span>{p.axis}</span>
                <span>{PENALTY_FMT.format(p.estimate)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KO licenses</CardTitle>
          <CardDescription>Critical permits that, when expired, force the linked axis to 0.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {result.koLicenses.map((lic) => (
              <li key={lic.key} className="flex items-center justify-between border-b pb-2">
                <span>{lic.label}</span>
                <span className={lic.warning === 'EXPIRED' ? 'text-red-700 font-medium' : lic.warning === '30_DAYS' ? 'text-orange-700' : lic.warning === '90_DAYS' ? 'text-yellow-700' : 'text-muted-foreground'}>
                  {lic.warning === 'OK' ? (lic.daysUntilExpiry == null ? 'Not provided' : `${lic.daysUntilExpiry} days`)
                    : lic.warning === 'EXPIRED' ? `Expired ${Math.abs(lic.daysUntilExpiry ?? 0)} days ago`
                    : `${lic.daysUntilExpiry} days — warning`}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link to="/manager/compliance/reform" className={buttonVariants()}>
          Open 12-week reform plan →
        </Link>
      </div>
    </>
  )
}
