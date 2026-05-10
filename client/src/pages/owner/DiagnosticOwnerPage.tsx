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
import { api } from '@/lib/api'
import { OWNER_QUESTIONS, type OwnerAnswers, type OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'
import { useDiagnosticStore } from '@/store/diagnosticStore'

const TOTAL_STEPS = 1 + OWNER_QUESTIONS.length // identification + 8 weighted

export function DiagnosticOwnerPage() {
  const navigate = useNavigate()
  const { draft, step, setDraft, setStep, setResult, reset } = useDiagnosticStore()
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
      toast.success('Diagnostic complete')
      navigate('/diagnostic/result')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not submit diagnostic'
      toast.error(msg)
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
        title="Owner diagnostic"
        description="9-step assessment — identifies your strategic path and 4 urgent actions."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset()
              toast.message('Diagnostic reset')
            }}
          >
            Reset
          </Button>
        }
      />

      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
          <CardTitle className="mt-3">
            {isIdentificationStep ? 'Company information' : question!.label}
          </CardTitle>
          {!isIdentificationStep && question && (
            <CardDescription>{question.prompt}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="grid gap-4">
          {isIdentificationStep ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={draft.companyName ?? ''}
                  onChange={(e) => setDraft({ companyName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  placeholder="retail, services, tech, manufacturing…"
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
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
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
            Back
          </Button>
          <Button onClick={next} disabled={!canAdvance || submitting}>
            {submitting ? 'Submitting…' : step === TOTAL_STEPS - 1 ? 'Submit' : 'Next'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
