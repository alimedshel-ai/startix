import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PathBadge, pathLabel } from '@/components/PathBadge'
import { RadarChart } from '@/components/charts/RadarChart'
import { api, apiErrorMessage } from '@/lib/api'
import { OWNER_QUESTIONS, type OwnerAnswers, type OwnerDiagnosticResult, type StrategicPath } from '@/lib/diagnosticQuestions'
import { useDiagnosticStore } from '@/store/diagnosticStore'

const TOTAL_STEPS = 1 + OWNER_QUESTIONS.length // تعريف + 8 موزّنة

const PATH_LABEL_BY_KEY: Record<StrategicPath, string> = {
  EMERGENCY_RISK: 'إنقاذ / خطر',
  NASCENT_CAUTIOUS: 'نشأة / حذر',
  GROWING_CHAOTIC: 'نمو / فوضى',
  MATURE_COMPETITIVE: 'نضج / تنافسية',
  DEFAULT_STRATEGIC: 'مسار افتراضي',
}

const AXIS_LABEL_AR: Record<string, string> = {
  Governance: 'الحوكمة',
  Financial: 'المالية',
  Team: 'الفريق',
  Digital: 'الرقمي',
}

const SCENARIO_LABEL: Record<string, string> = {
  optimistic: 'سيناريو متفائل',
  pessimistic: 'سيناريو متشائم',
}

export function TryDiagnosticPage() {
  const navigate = useNavigate()
  const { draft, step, result, setDraft, setStep, setResult, reset, markPendingPersist } = useDiagnosticStore()
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
      // نقطة عامة — تحسب النتيجة بدون حفظ
      const { data } = await api.post<{ result: OwnerDiagnosticResult }>('/api/diagnostic/preview', draft)
      setResult(data.result)
      markPendingPersist() // علم: لما المستخدم يسجل، نحفظها فعلياً
      toast.success('اكتمل التشخيص — نتيجتك جاهزة')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'تعذّر حساب النتيجة'))
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

  function startOver() {
    reset()
    toast.message('تم إعادة الضبط')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">س</div>
            <span className="text-lg font-semibold tracking-tight">ستارتكس</span>
          </Link>
          <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            لديك حساب؟ تسجيل الدخول
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {result ? (
          <ResultView
            result={result}
            onSave={() => navigate('/select-type')}
            onReset={startOver}
          />
        ) : (
          <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-primary" />
                تشخيص مالك مجاني · بدون تسجيل
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                اكتشف مسارك الاستراتيجي
              </h1>
              <p className="mt-3 text-muted-foreground">
                9 خطوات · نتيجة فورية · النتيجة تُحفظ تلقائياً عند تسجيل حسابك.
              </p>
            </div>

            <Card className="overflow-hidden shadow-sm">
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
                  {submitting ? 'جاري الحساب…' : step === TOTAL_STEPS - 1 ? 'عرض النتيجة' : 'التالي'}
                </Button>
              </CardFooter>
            </Card>
          </section>
        )}
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} ستارتكس.</span>
          <Link to="/" className="hover:text-foreground">العودة للرئيسية</Link>
        </div>
      </footer>
    </div>
  )
}

function ResultView({
  result,
  onSave,
  onReset,
}: {
  result: OwnerDiagnosticResult
  onSave: () => void
  onReset: () => void
}) {
  const radarTranslated = result.radarData.map((r) => ({
    axis: AXIS_LABEL_AR[r.axis] ?? r.axis,
    value: r.value,
  }))

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          نتيجة تشخيصك
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          مسارك الاستراتيجي + خريطة الـ 90 يوماً
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-transparent md:col-span-5">
          <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
          <CardHeader>
            <CardDescription>المسار الاستراتيجي الموصى به</CardDescription>
            <CardTitle className="flex items-center gap-3">
              <PathBadge path={result.strategicPath} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold tabular-nums text-primary">{result.maturityScore}</div>
              <div className="text-sm text-muted-foreground">/ 100 درجة النضج</div>
            </div>
            <ul className="mt-4 grid gap-1.5 text-xs">
              {(['EMERGENCY_RISK', 'NASCENT_CAUTIOUS', 'GROWING_CHAOTIC', 'MATURE_COMPETITIVE'] as const).map((k) => (
                <li key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{PATH_LABEL_BY_KEY[k]}</span>
                  <span className="tabular-nums font-medium">{result.pathScores[k]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/5 md:col-span-7">
          <CardHeader>
            <CardTitle>رسم القدرات الراداري</CardTitle>
            <CardDescription>الحوكمة · المالية · الفريق · الرقمي — كل محور 0–100.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={radarTranslated} />
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-500/5 to-transparent md:col-span-6">
          <CardHeader>
            <CardTitle>أبرز نقاط الضعف</CardTitle>
            <CardDescription>الأبعاد الأقل تقييماً — ابدأ بها.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {result.weaknesses.map((w) => (
                <li key={w.key} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                  <span>{w.label}</span>
                  <span className="tabular-nums text-muted-foreground">{w.pct}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/5 to-transparent md:col-span-6">
          <CardHeader>
            <CardTitle>إجراءات عاجلة</CardTitle>
            <CardDescription>4 خطوات تنفّذها في الـ 90 يوم القادمة.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm">
              {result.roadmap.map((a, i) => (
                <li key={`${a.source}-${i}`} className="rounded-xl border bg-card p-3">
                  <span className="ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{a.title}.</span>{' '}
                  <span className="text-muted-foreground">{a.detail}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="md:col-span-12">
          <CardHeader>
            <CardTitle>معاينة السيناريوهات</CardTitle>
            <CardDescription>
              نتيجتان محتملتان لمسار {pathLabel(result.strategicPath)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {result.scenarios.map((s) => (
              <div key={s.name} className="rounded-xl border bg-gradient-to-br from-card to-primary/5 p-4">
                <div className="text-xs uppercase tracking-wider text-primary">{SCENARIO_LABEL[s.name] ?? s.name}</div>
                <div className="mt-1 font-semibold">{s.headline}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-12 overflow-hidden">
          <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              احفظ نتيجتك في حسابك
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              سجّل حساباً مجانياً وسنحفظ تشخيصك تلقائياً.
              ستحصل أيضاً على لوحات قيادة، تدقيق 13 إدارة، تحليل امتثال سعودي، وتقارير قابلة للتصدير.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button size="lg" onClick={onSave}>
                سجّل حساب وحفظ النتيجة
              </Button>
              <Button variant="outline" size="lg" onClick={onReset}>
                إعادة التشخيص
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              نتيجتك محفوظة محلياً في متصفحك حتى تسجّل.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
