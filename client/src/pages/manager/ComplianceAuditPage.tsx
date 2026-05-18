import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  dangerZoneColor,
  getComplianceQuestions,
  getMyFirstCompany,
  submitComplianceBasic,
  type ComplianceBasicResult,
} from '@/lib/deptApi'

interface BasicQuestion {
  id: string
  prompt: string
  options: { value: string; label: string }[]
}

const ZONE_LABEL: Record<string, string> = {
  GREEN: 'آمنة',
  YELLOW: 'تحذير',
  ORANGE: 'خطر',
  RED: 'حرجة',
}

export function ComplianceAuditPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<BasicQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ComplianceBasicResult | null>(null)

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
        const data = await getComplianceQuestions(company.id, 'basic')
        if (cancel) return
        setQuestions(data.questions)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل الأسئلة'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const total = questions.length
  const current = questions[step]
  const value = current ? answers[current.id] : undefined
  const canAdvance = Boolean(value)
  const progress = total === 0 ? 0 : Math.round(((step + 1) / total) * 100)

  async function submit() {
    if (!companyId) return
    setSubmitting(true)
    try {
      const payload = Object.entries(answers).map(([questionId, v]) => ({ questionId, value: v }))
      const res = await submitComplianceBasic(companyId, payload)
      setResult(res.result)
      toast.success('تم إرسال تدقيق الامتثال')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر إرسال التدقيق'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (!current) return
    if (step < total - 1) setStep(step + 1)
    else submit()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تدقيق الامتثال (الأساسي)"
        description="8 أسئلة سريعة تغطي التراخيص، الضريبة، العمل، الخصوصية، الأمن السيبراني، الحوكمة، مكافحة غسل الأموال وحماية المستهلك."
        breadcrumbs={[
          { label: 'الأقسام', to: '/manager/select-dept' },
          { label: 'الامتثال' },
        ]}
        actions={
          <Link to="/manager/compliance/audit-pro" className={buttonVariants({ variant: 'outline' })}>
            التبديل إلى الاحترافي
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري التحميل…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !result && current && (
        <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
          <CardHeader>
            <CardTitle>السؤال <span className="tabular-nums">{step + 1}</span> من <span className="tabular-nums">{total}</span></CardTitle>
            <CardDescription>4 خيارات · مقياس النضج (ليكرت)</CardDescription>
            <Progress value={progress} className="mt-2 h-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base font-medium">{current.prompt}</p>
            <RadioGroup
              value={value ?? ''}
              onValueChange={(v) => setAnswers((prev) => ({ ...prev, [current.id]: String(v) }))}
              className="gap-2"
            >
              {current.options.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`${current.id}_${opt.value}`}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <RadioGroupItem value={opt.value} id={`${current.id}_${opt.value}`} />
                  <span className="text-sm">{opt.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>السابق</Button>
            <Button onClick={next} disabled={!canAdvance || submitting}>
              {step === total - 1 ? (submitting ? 'جاري الإرسال…' : 'إرسال') : 'التالي'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {result && (
        <Card className="overflow-hidden bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
          <div className="h-1.5 bg-gradient-to-l from-rose-500 via-red-500 to-orange-500" />
          <CardHeader>
            <CardTitle>نضج الامتثال</CardTitle>
            <CardDescription>استناداً إلى {questions.length} أسئلة. {result.dangerZone === 'RED' ? 'تم رصد تعرّض حرج.' : null}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-semibold tabular-nums">{result.maturityPct}%</div>
              <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${dangerZoneColor(result.dangerZone)}`}>منطقة {ZONE_LABEL[result.dangerZone] ?? result.dangerZone}</span>
            </div>
            <Progress value={result.maturityPct} className="h-2" />
            <p className="text-xs text-muted-foreground tabular-nums">النقاط الخام {result.rawScore} / {result.maxScore}.</p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Link to="/manager/compliance/audit-pro" className={buttonVariants({ variant: 'outline' })}>
              تنفيذ التدقيق الاحترافي (64 عنصراً)
            </Link>
            <Link to="/manager/compliance/reform" className={buttonVariants()}>
              عرض خطة الإصلاح ←
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
