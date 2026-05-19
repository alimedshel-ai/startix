import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { aiPainScreen } from '@/lib/aiApi'
import { apiErrorMessage } from '@/lib/api'

const QUESTIONS: string[] = [
  'ما الجانب الأكثر استهلاكاً لوقتك يومياً؟',
  'أين تخسر المال أكثر من اللازم؟',
  'ما القرار الذي تأجّل تكراراً ولم يُحسم؟',
  'ما المشكلة التي تتكرر دون حل جذري؟',
  'ما الشيء الذي لو تحسّن سيغيّر النتائج جوهرياً؟',
]

interface Pain {
  title: string
  severity: number
  rootCause?: string
  recommendedTools: { label: string; to: string }[]
}

function severityTint(s: number): { tint: string; chip: string; label: string } {
  if (s >= 5) return { tint: 'border-rose-300 bg-rose-50/60',     chip: 'bg-rose-500 text-white',    label: 'حادة جداً' }
  if (s >= 4) return { tint: 'border-orange-300 bg-orange-50/60', chip: 'bg-orange-500 text-white',  label: 'حادة' }
  if (s >= 3) return { tint: 'border-amber-300 bg-amber-50/60',   chip: 'bg-amber-500 text-amber-900', label: 'متوسطة' }
  if (s >= 2) return { tint: 'border-sky-300 bg-sky-50/60',       chip: 'bg-sky-500 text-white',     label: 'منخفضة' }
  return { tint: 'border-emerald-300 bg-emerald-50/60', chip: 'bg-emerald-500 text-white', label: 'هامشية' }
}

export function PainScreenPage() {
  return (
    <StrategicShell
      title="فحص نقاط الألم"
      description="٥ أسئلة سريعة → Claude يحدد أهم ٣ نقاط ألم في عملك ويقترح أدوات حلها."
    >
      {(companyId) => <Screen companyId={companyId} />}
    </StrategicShell>
  )
}

function Screen({ companyId }: { companyId: string }) {
  const [answers, setAnswers] = useState<string[]>(QUESTIONS.map(() => ''))
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ pains: Pain[] } | null>(null)

  const filled = answers.filter((a) => a.trim().length >= 5).length

  async function submit() {
    const payload = QUESTIONS.map((q, i) => ({ question: q, answer: answers[i] }))
      .filter((p) => p.answer.trim().length >= 5)
    if (payload.length < 3) {
      toast.error('أكمل 3 إجابات على الأقل (٥ حروف فأكثر).')
      return
    }
    setSubmitting(true)
    try {
      const res = await aiPainScreen({ companyId, answers: payload })
      setResult(res)
      toast.success(`تم تحديد ${res.pains.length} نقطة ألم`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحليل'))
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setAnswers(QUESTIONS.map(() => ''))
    setResult(null)
  }

  if (result) {
    return (
      <>
        <Card className="overflow-hidden bg-gradient-to-bl from-amber-500/10 to-transparent">
          <div className="h-1.5 bg-gradient-to-l from-amber-500 via-orange-500 to-rose-500" />
          <CardHeader>
            <CardTitle>أهم {result.pains.length} نقاط ألم</CardTitle>
            <CardDescription>مرتّبة من الأكثر حدّة، مع أدوات موصى بها للمعالجة.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={reset}>إعادة الفحص</Button>
          </CardFooter>
        </Card>

        <div className="grid gap-3">
          {result.pains.map((p, i) => {
            const s = severityTint(p.severity)
            return (
              <Card key={i} className={s.tint}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                      {p.title}
                    </CardTitle>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.chip}`}>
                      {s.label} ({p.severity}/5)
                    </span>
                  </div>
                  {p.rootCause && (
                    <CardDescription className="leading-relaxed">
                      <span className="font-medium">السبب الجذري: </span>
                      {p.rootCause}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-xs font-medium text-muted-foreground">أدوات موصى بها:</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.recommendedTools.map((t, j) => (
                      <Link
                        key={j}
                        to={t.to}
                        className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs transition hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        {t.label} ←
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-bl from-amber-500/10 to-transparent">
      <div className="h-1.5 bg-gradient-to-l from-amber-500 via-orange-500 to-rose-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🩺</span>
          ٥ أسئلة موجزة
        </CardTitle>
        <CardDescription>أجب على الأقل عن 3 أسئلة. كل إجابة عبارة قصيرة تكفي.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {QUESTIONS.map((q, i) => (
          <div key={i} className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
              {q}
            </div>
            <Textarea
              rows={2}
              value={answers[i]}
              onChange={(e) => setAnswers((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))}
              placeholder="إجابتك…"
            />
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">أُكملت {filled} من 5.</span>
        <Button onClick={submit} disabled={submitting || filled < 3}>
          {submitting ? 'جاري التحليل…' : '🩺 ابدأ الفحص'}
        </Button>
      </CardFooter>
    </Card>
  )
}
