import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PageHeader } from '@/components/PageHeader'
import { api, apiErrorMessage } from '@/lib/api'
import { OWNER_QUESTIONS, type OwnerAnswers, type OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'
import { useDiagnosticStore } from '@/store/diagnosticStore'

const TOTAL_STEPS = 1 + OWNER_QUESTIONS.length // identification + 8 weighted

export function DiagnosticOwnerPage() {
  const navigate = useNavigate()
  const draft = useDiagnosticStore((s) => s.ownerDraft)
  const step = useDiagnosticStore((s) => s.ownerStep)
  const setDraft = useDiagnosticStore((s) => s.setOwnerDraft)
  const setStep = useDiagnosticStore((s) => s.setOwnerStep)
  const setResult = useDiagnosticStore((s) => s.setOwnerResult)
  const reset = useDiagnosticStore((s) => s.reset)
  const [submitting, setSubmitting] = useState(false)

  const progress = Math.round(((step + 1) / TOTAL_STEPS) * 100)
  const isIdentificationStep = step === 0
  const question = isIdentificationStep ? null : OWNER_QUESTIONS[step - 1]
  const currentValue = question
    ? (draft[question.key as keyof OwnerAnswers] as string | undefined)
    : undefined

  const canAdvance = isIdentificationStep
    ? Boolean(draft.companyName && draft.sector)
    : Boolean(currentValue)

  async function submit() {
    setSubmitting(true)
    try {
      const { data } = await api.post<{ result: OwnerDiagnosticResult }>(
        '/api/diagnostic/owner',
        draft
      )
      setResult(data.result)
      toast.success('اكتمل التشخيص')
      navigate('/diagnostic/result')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'تعذّر إرسال التشخيص'))
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
      return
    }
    submit()
  }

  function back() {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تشخيص المالك"
        description="تقييم من 9 خطوات — يحدد مسارك الاستراتيجي و 4 إجراءات عاجلة."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset()
              toast.message('تم إعادة ضبط التشخيص')
            }}
          >
            إعادة الضبط
          </Button>
        }
      />

      <Card className="mx-auto w-full max-w-2xl overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-rose-500" />
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>الخطوة {step + 1} من {TOTAL_STEPS}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <CardTitle className="mt-3">
            {isIdentificationStep ? 'معلومات الشركة' : question!.label}
          </CardTitle>
          {!isIdentificationStep && question && (
            <CardDescription className="leading-relaxed">{question.prompt}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="grid gap-4">
          {isIdentificationStep ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="companyName">اسم الشركة</Label>
                <Input
                  id="companyName"
                  value={draft.companyName ?? ''}
                  onChange={(e) => setDraft({ companyName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sector">القطاع</Label>
                <Input
                  id="sector"
                  placeholder="تجزئة، خدمات، تقنية، تصنيع…"
                  value={draft.sector ?? ''}
                  onChange={(e) => setDraft({ sector: e.target.value })}
                />
              </div>
            </>
          ) : (
            question && (
              <RadioGroup
                value={currentValue ?? ''}
                onValueChange={(v) =>
                  setDraft({ [question.key]: v } as Partial<OwnerAnswers>)
                }
                className="grid gap-2"
              >
                {question.options.map((o) => (
                  <Label
                    key={o.value}
                    htmlFor={`${question.key}-${o.value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition hover:bg-accent hover:shadow-sm"
                  >
                    <RadioGroupItem id={`${question.key}-${o.value}`} value={o.value} />
                    <span className="text-sm leading-snug">{o.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            )
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
            السابق
          </Button>
          <Button onClick={next} disabled={!canAdvance || submitting}>
            {submitting ? 'جاري الإرسال…' : step === TOTAL_STEPS - 1 ? 'إرسال' : 'التالي'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
