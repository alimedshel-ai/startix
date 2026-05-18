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
  onComplete?: (score: AuditScore) => void
}

const AXIS_LABEL: Record<string, string> = {
  governance: 'الحوكمة',
  financial:  'المالية',
  team:       'الفريق',
  digital:    'الرقمي',
}

const ZONE_LABEL: Record<string, string> = {
  GREEN:  'منطقة آمنة',
  YELLOW: 'منطقة تحذير',
  ORANGE: 'منطقة خطر',
  RED:    'منطقة حرجة',
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
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل الأسئلة'
        toast.error(msg)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => { cancel = true }
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
      toast.success('تم إرسال التدقيق')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل إرسال التدقيق'
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
          <CardTitle>جاري تحميل التدقيق…</CardTitle>
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
          <CardTitle>لا توجد أسئلة متاحة</CardTitle>
          <CardDescription>هذه الإدارة لا تحتوي على تدقيق مُعدّ بعد.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-rose-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{DEPT_ICON[deptCode]}</span>
          تدقيق {DEPT_LABEL[deptCode]} {variant === 'pro' ? '— احترافي' : ''}
        </CardTitle>
        <CardDescription>
          السؤال {step + 1} من {total} · المحور: {AXIS_LABEL[current!.axis]}
        </CardDescription>
        <Progress value={progress} className="mt-2 h-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base font-medium leading-relaxed">{current!.prompt}</p>
        <RadioGroup
          value={value ?? ''}
          onValueChange={(v) => setAnswers((prev) => ({ ...prev, [current!.id]: String(v) }))}
          className="gap-2"
        >
          {current!.options.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`${current!.id}_${opt.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:bg-accent hover:shadow-sm"
            >
              <RadioGroupItem value={opt.value} id={`${current!.id}_${opt.value}`} />
              <span className="text-sm">{opt.label}</span>
            </Label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          أجبت {Object.keys(answers).length} · متبقي {total - Object.keys(answers).length}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0}>السابق</Button>
        <Button onClick={next} disabled={!canAdvance || submitting}>
          {step === total - 1 ? (submitting ? 'جاري الإرسال…' : 'إرسال') : 'التالي'}
        </Button>
      </CardFooter>
      <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
        الأقسام: حوكمة {grouped.governance.length} · مالية {grouped.financial.length} · فريق {grouped.team.length} · رقمي {grouped.digital.length}
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
    <Card className="overflow-hidden shadow-sm">
      <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden>{DEPT_ICON[deptCode]}</span>
          نتيجة تدقيق {DEPT_LABEL[deptCode]}
        </CardTitle>
        <CardDescription>تقييم نضج عبر ٤ محاور · إجمالي {AXIS_CAP_TOTAL} نقطة</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-3xl font-semibold tabular-nums">{score.healthPct}%</div>
            <div className="text-sm text-muted-foreground">النضج ({score.total} / {AXIS_CAP_TOTAL})</div>
          </div>
          <span className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium ${zoneCls}`}>
            {ZONE_LABEL[score.dangerZone] ?? score.dangerZone}
          </span>
        </div>
        <Progress value={score.healthPct} className="h-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {score.byAxis.map((row) => {
            const pct = row.cap === 0 ? 0 : Math.round((row.score / row.cap) * 100)
            return (
              <div key={row.axis} className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">{AXIS_LABEL[row.axis]}</div>
                <div className="text-lg font-semibold tabular-nums">{row.score} <span className="text-xs text-muted-foreground">/ {row.cap}</span></div>
                <Progress value={pct} className="mt-1 h-1.5" />
              </div>
            )
          })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {onRestart ? <Button variant="ghost" onClick={onRestart}>إعادة التدقيق</Button> : <span />}
        <Button onClick={() => window.print()} variant="outline">طباعة</Button>
      </CardFooter>
    </Card>
  )
}

const AXIS_CAP_TOTAL = 100
