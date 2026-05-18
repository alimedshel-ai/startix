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

const ZONE_LABEL: Record<string, string> = {
  GREEN: 'آمنة',
  YELLOW: 'تحذير',
  ORANGE: 'خطر',
  RED: 'حرجة',
}

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
          toast.error('أكمل تشخيص المدير أولاً')
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
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل التدقيق الاحترافي'
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
      toast.error(`يرجى الإجابة على جميع الأسئلة (${questions.length}) قبل الإرسال.`)
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
      toast.success('تم إرسال التدقيق الاحترافي')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر إرسال التدقيق'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تدقيق الامتثال (احترافي)"
        description="64 عنصراً إلزامياً عبر 8 محاور + محاور خاصة بالقطاع. تراخيص KO تفرض إعطاء المحور صفراً عند انتهاء صلاحيتها."
        breadcrumbs={[
          { label: 'الأقسام', to: '/manager/select-dept' },
          { label: 'الامتثال', to: '/manager/compliance/audit' },
          { label: 'احترافي' },
        ]}
        actions={
          <Link to="/manager/compliance/audit" className={buttonVariants({ variant: 'outline' })}>
            العودة إلى الأساسي
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري تحميل التدقيق الاحترافي…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !result && (
        <>
          <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
            <CardHeader>
              <CardTitle>التقدم</CardTitle>
              <CardDescription><span className="tabular-nums">{answeredCount}</span> من <span className="tabular-nums">{questions.length}</span> تمت الإجابة عليها.</CardDescription>
              <Progress value={progress} className="mt-2 h-2" />
            </CardHeader>
          </Card>

          {koDefs.length > 0 && (
            <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
              <CardHeader>
                <CardTitle>KO الذكية — التراخيص وتواريخ الانتهاء</CardTitle>
                <CardDescription>التراخيص المنتهية تفرض صفراً على المحور وتُفعّل الغرامة. تحذيرات عند 30 و90 يوماً.</CardDescription>
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
                  <CardDescription>الجهة التنظيمية: {axis.regulator} · <span className="tabular-nums">{qs.length}</span> أسئلة · {axis.mandatory ? 'محور إلزامي' : 'حسب القطاع'}</CardDescription>
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
              {submitting ? 'جاري الإرسال…' : `إرسال (${answeredCount}/${questions.length})`}
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
      <Card className="overflow-hidden bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-red-500 to-orange-500" />
        <CardHeader>
          <CardTitle>النضج الإجمالي</CardTitle>
          <CardDescription>{result.dangerZone === 'RED' ? 'تعرّض حرج عبر محاور متعددة.' : 'انظر التفصيل لكل محور أدناه.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-semibold tabular-nums">{result.overallMaturityPct}%</div>
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${dangerZoneColor(result.dangerZone)}`}>منطقة {ZONE_LABEL[result.dangerZone] ?? result.dangerZone}</span>
          </div>
          <Progress value={result.overallMaturityPct} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>النضج لكل محور</CardTitle>
          <CardDescription>المحاور الإلزامية تظهر أولاً.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {result.axes.map((a) => (
              <div key={a.axis} className="rounded-md border p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.regulator}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(a.dangerZone)}`}>{ZONE_LABEL[a.dangerZone] ?? a.dangerZone}</span>
                </div>
                <div className="mt-2 text-xl font-semibold tabular-nums">{a.maturityPct}%</div>
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
          <CardTitle>مصفوفة المخاطر</CardTitle>
          <CardDescription>أبرز 8 محاور مرتّبة من الأقل نضجاً.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="py-2">المحور</th>
                <th className="py-2">الاحتمالية</th>
                <th className="py-2">الأثر</th>
                <th className="py-2">الخطورة</th>
                <th className="py-2">أبرز خطر محدد</th>
              </tr>
            </thead>
            <tbody>
              {result.riskMatrix.map((row) => (
                <tr key={row.axis} className="border-b">
                  <td className="py-2 font-medium">{row.label}</td>
                  <td className="py-2 tabular-nums">{row.probability}</td>
                  <td className="py-2 tabular-nums">{row.impact}</td>
                  <td className="py-2 font-semibold tabular-nums">{row.risk}</td>
                  <td className="py-2 text-muted-foreground">{row.topRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-200">
        <CardHeader>
          <CardTitle>تعرّض الغرامات السعودية</CardTitle>
          <CardDescription>تقدير معدّل وفق أوزان المحاور وفجوات النضج.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between border-b pb-2">
            <span className="text-muted-foreground">الحد الأقصى للغرامة (سقف الكيان)</span>
            <span className="font-medium tabular-nums">{PENALTY_FMT.format(result.penaltyEstimate.maxPenalty)}</span>
          </div>
          <div className="flex items-baseline justify-between border-b pb-2">
            <span className="text-muted-foreground">التعرّض التقديري</span>
            <span className="text-lg font-semibold text-red-700 tabular-nums">{PENALTY_FMT.format(result.penaltyEstimate.estimate)}</span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {result.penaltyEstimate.perAxis.map((p) => (
              <li key={p.axis} className="flex justify-between">
                <span>{p.axis}</span>
                <span className="tabular-nums">{PENALTY_FMT.format(p.estimate)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تراخيص KO</CardTitle>
          <CardDescription>التصاريح الحرجة التي عند انتهائها تفرض صفراً على المحور المرتبط.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {result.koLicenses.map((lic) => (
              <li key={lic.key} className="flex items-center justify-between border-b pb-2">
                <span>{lic.label}</span>
                <span className={lic.warning === 'EXPIRED' ? 'text-red-700 font-medium' : lic.warning === '30_DAYS' ? 'text-orange-700' : lic.warning === '90_DAYS' ? 'text-yellow-700' : 'text-muted-foreground'}>
                  {lic.warning === 'OK' ? (lic.daysUntilExpiry == null ? 'غير محدد' : <span className="tabular-nums">{lic.daysUntilExpiry} يوماً</span>)
                    : lic.warning === 'EXPIRED' ? <span className="tabular-nums">انتهى منذ {Math.abs(lic.daysUntilExpiry ?? 0)} يوماً</span>
                    : <span className="tabular-nums">{lic.daysUntilExpiry} يوماً — تحذير</span>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link to="/manager/compliance/reform" className={buttonVariants()}>
          فتح خطة الإصلاح لـ 12 أسبوعاً ←
        </Link>
      </div>
    </>
  )
}
