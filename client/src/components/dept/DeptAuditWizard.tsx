import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  DEPT_ICON,
  DEPT_LABEL,
  type AuditScore,
  type DeptCode,
  type DeptQuestion,
  dangerZoneColor,
  getDeptQuestions,
  submitDeptAudit,
  submitDeptAuditPro,
} from '@/lib/deptApi'

interface Props {
  deptId: string
  deptCode: DeptCode
  variant?: 'basic' | 'pro'
  /** Called after a successful audit submission. */
  onComplete?: (score: AuditScore) => void
}

const AXIS_LABEL: Record<string, string> = {
  governance: 'Governance',
  financial: 'Financial',
  team: 'Team',
  digital: 'Digital',
}

export function DeptAuditWizard({ deptId, deptCode, variant = 'basic', onComplete }: Props) {
  const [questions, setQuestions] = useState<DeptQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<AuditScore | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getDeptQuestions(deptId, variant)
      .then(({ questions }) => {
        if (cancel) return
        setQuestions(questions)
      })
      .catch((err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load questions'
        toast.error(msg)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [deptId, variant])

  const total = questions.length
  const progress = total === 0 ? 0 : Math.round(((step + 1) / total) * 100)
  const current = questions[step]
  const value = current ? answers[current.id] : undefined
  const canAdvance = Boolean(value)

  const grouped = useMemo(() => {
    const m: Record<string, DeptQuestion[]> = { governance: [], financial: [], team: [], digital: [] }
    for (const q of questions) m[q.axis].push(q)
    return m
  }, [questions])

  async function submit() {
    if (!current) return
    const payload = Object.entries(answers).map(([questionId, v]) => ({ questionId, value: v }))
    setSubmitting(true)
    try {
      const { score } = variant === 'pro'
        ? await submitDeptAuditPro(deptId, payload)
        : await submitDeptAudit(deptId, payload)
      setScore(score)
      onComplete?.(score)
      toast.success('Audit submitted')
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
  function back() {
    if (step > 0) setStep(step - 1)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading audit…</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (score) {
    return <DeptAuditResult deptCode={deptCode} score={score} onRestart={() => { setScore(null); setStep(0); setAnswers({}) }} />
  }

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No questions available</CardTitle>
          <CardDescription>This department has no audit configured yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden>{DEPT_ICON[deptCode]}</span>
          {DEPT_LABEL[deptCode]} audit {variant === 'pro' ? '(Pro)' : ''}
        </CardTitle>
        <CardDescription>
          Question {step + 1} of {total} · Axis: {AXIS_LABEL[current!.axis]}
        </CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base font-medium">{current!.prompt}</p>
        <RadioGroup
          value={value ?? ''}
          onValueChange={(v) => setAnswers((prev) => ({ ...prev, [current!.id]: String(v) }))}
          className="gap-2"
        >
          {current!.options.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`${current!.id}_${opt.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
            >
              <RadioGroupItem value={opt.value} id={`${current!.id}_${opt.value}`} />
              <span className="text-sm">{opt.label}</span>
            </Label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Answered {Object.keys(answers).length} · Skipped {total - Object.keys(answers).length}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0}>Back</Button>
        <Button onClick={next} disabled={!canAdvance || submitting}>
          {step === total - 1 ? (submitting ? 'Submitting…' : 'Submit') : 'Next'}
        </Button>
      </CardFooter>
      <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
        Sections: G {grouped.governance.length} · F {grouped.financial.length} · T {grouped.team.length} · D {grouped.digital.length}
      </CardFooter>
    </Card>
  )
}

// ─── Results card ──────────────────────────────────────────────────────────

interface ResultProps {
  deptCode: DeptCode
  score: AuditScore
  onRestart?: () => void
}

export function DeptAuditResult({ deptCode, score, onRestart }: ResultProps) {
  const zoneCls = dangerZoneColor(score.dangerZone)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden>{DEPT_ICON[deptCode]}</span>
          {DEPT_LABEL[deptCode]} audit result
        </CardTitle>
        <CardDescription>4-axis maturity scoring · max {AXIS_CAP_TOTAL} pts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-3xl font-semibold">{score.healthPct}%</div>
            <div className="text-sm text-muted-foreground">Maturity ({score.total} / {AXIS_CAP_TOTAL})</div>
          </div>
          <span className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium ${zoneCls}`}>
            {score.dangerZone}
          </span>
        </div>
        <Progress value={score.healthPct} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {score.byAxis.map((row) => {
            const pct = row.cap === 0 ? 0 : Math.round((row.score / row.cap) * 100)
            return (
              <div key={row.axis} className="rounded-md border p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">{AXIS_LABEL[row.axis]}</div>
                <div className="text-lg font-semibold">{row.score} <span className="text-xs text-muted-foreground">/ {row.cap}</span></div>
                <Progress value={pct} className="mt-1 h-1.5" />
              </div>
            )
          })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {onRestart ? <Button variant="ghost" onClick={onRestart}>Re-take</Button> : <span />}
        <Button onClick={() => window.print()} variant="outline">Print</Button>
      </CardFooter>
    </Card>
  )
}

const AXIS_CAP_TOTAL = 100
