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
          toast.error('Complete the manager diagnostic first')
          setLoading(false)
          return
        }
        setCompanyId(company.id)
        const data = await getComplianceQuestions(company.id, 'basic')
        if (cancel) return
        setQuestions(data.questions)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load questions'
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
      toast.success('Compliance audit submitted')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not submit audit'
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
        title="Compliance audit (Basic)"
        description="8 quick questions across licenses, tax, labor, privacy, cybersecurity, governance, AML and consumer protection."
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: 'Compliance' },
        ]}
        actions={
          <Link to="/manager/compliance/audit-pro" className={buttonVariants({ variant: 'outline' })}>
            Switch to Pro
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !result && current && (
        <Card>
          <CardHeader>
            <CardTitle>Question {step + 1} of {total}</CardTitle>
            <CardDescription>4 choices · Likert maturity</CardDescription>
            <Progress value={progress} className="mt-2" />
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
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
                >
                  <RadioGroupItem value={opt.value} id={`${current.id}_${opt.value}`} />
                  <span className="text-sm">{opt.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            <Button onClick={next} disabled={!canAdvance || submitting}>
              {step === total - 1 ? (submitting ? 'Submitting…' : 'Submit') : 'Next'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance maturity</CardTitle>
            <CardDescription>Based on {questions.length} questions. {result.dangerZone === 'RED' ? 'Critical exposure detected.' : null}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-semibold">{result.maturityPct}%</div>
              <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${dangerZoneColor(result.dangerZone)}`}>{result.dangerZone} zone</span>
            </div>
            <Progress value={result.maturityPct} />
            <p className="text-xs text-muted-foreground">Raw {result.rawScore} / {result.maxScore} pts.</p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Link to="/manager/compliance/audit-pro" className={buttonVariants({ variant: 'outline' })}>
              Run Pro audit (64 elements)
            </Link>
            <Link to="/manager/compliance/reform" className={buttonVariants()}>
              See reform plan →
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
