import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// تشخيص أولي مجاني قبل التسجيل. 5 أسئلة مختصرة، نتيجة فورية بصرية،
// ثم CTA للحصول على التحليل الكامل (مسار استراتيجي + خطة 90 يوم).
// كل الحسابات محلية — لا تتطلب الـ backend ولا تسجيل.

type Choice = { value: string; label: string; points: number }
type Question = { key: string; title: string; axis: 'حوكمة' | 'مالية' | 'فريق' | 'رقمي' | 'مرحلة'; choices: Choice[] }

const QUESTIONS: Question[] = [
  {
    key: 'stage',
    axis: 'مرحلة',
    title: 'كيف تصف مرحلة شركتك اليوم؟',
    choices: [
      { value: 'a', label: 'متعثرة — في وضع البقاء',     points: 10 },
      { value: 'b', label: 'ناشئة — أقل من سنتين',        points: 35 },
      { value: 'c', label: 'في نموّ — تتوسّع بسرعة',       points: 70 },
      { value: 'd', label: 'مستقرّة — راسخة ومربحة',       points: 95 },
    ],
  },
  {
    key: 'liquidity',
    axis: 'مالية',
    title: 'ما مدى صحة السيولة لديك؟',
    choices: [
      { value: 'a', label: 'حرجة — أقل من شهر',            points: 5 },
      { value: 'b', label: 'منخفضة — 1–3 أشهر',             points: 30 },
      { value: 'c', label: 'متوسطة — 3–6 أشهر',             points: 65 },
      { value: 'd', label: 'عالية — 6 أشهر فأكثر',          points: 95 },
    ],
  },
  {
    key: 'dependency',
    axis: 'فريق',
    title: 'إلى أيّ مدى تعتمد الشركة عليك شخصياً؟',
    choices: [
      { value: 'a', label: 'كلّي — لا شيء يحدث بدوني',     points: 10 },
      { value: 'b', label: 'عالٍ — القرارات الكبرى فقط',    points: 45 },
      { value: 'c', label: 'منخفض — تعمل بدوني لأسابيع',    points: 90 },
    ],
  },
  {
    key: 'governance',
    axis: 'حوكمة',
    title: 'ما مستوى الحوكمة لديك؟',
    choices: [
      { value: 'a', label: 'لا توجد حوكمة رسمية',           points: 10 },
      { value: 'b', label: 'جزئية — بعض الإجراءات المكتوبة', points: 40 },
      { value: 'c', label: 'نظام معتمد + تفويضات',          points: 75 },
      { value: 'd', label: 'مجلس فعّال + لجان رسمية',        points: 95 },
    ],
  },
  {
    key: 'tracking',
    axis: 'رقمي',
    title: 'كيف تتابع الأرقام المالية اليوم؟',
    choices: [
      { value: 'a', label: 'بدون متابعة',                    points: 5 },
      { value: 'b', label: 'يدوية / جداول إكسل',             points: 35 },
      { value: 'c', label: 'نظام محاسبة وإقفال شهري',         points: 70 },
      { value: 'd', label: 'لوحات لحظية + قوائم مدققة',       points: 95 },
    ],
  },
]

interface ResultBand {
  band: 'حرج' | 'يحتاج عمل' | 'جيد' | 'متقدّم'
  color: string
  ring: string
  headline: string
  bullets: string[]
}

function bandFor(score: number): ResultBand {
  if (score < 35) return {
    band: 'حرج',
    color: 'text-rose-600',
    ring: 'ring-rose-300 from-rose-500/15',
    headline: 'مؤسستك في منطقة خطر — تحتاج تدخّلاً سريعاً.',
    bullets: [
      'الأولوية الأولى: حماية السيولة وتمديد المدى الزمني للنقد.',
      'وثّق أهم 10 قرارات لتقليل الاعتماد على شخص واحد.',
      'ابدأ بإغلاق شهري بسيط حتى تعرف وضعك المالي بدقة.',
    ],
  }
  if (score < 60) return {
    band: 'يحتاج عمل',
    color: 'text-amber-600',
    ring: 'ring-amber-300 from-amber-500/15',
    headline: 'هناك أساس لكن فيه فجوات حقيقية تستحقّ المعالجة.',
    bullets: [
      'ركّب حوكمة خفيفة: مصفوفة تفويض ومراجعة شهرية للأعمال.',
      'فعّل نظام محاسبة وأقفل دفاترك شهرياً قبل نهاية الشهر القادم.',
      'حدّد 3 مؤشرات حرجة لمتابعتها أسبوعياً مع القيادة.',
    ],
  }
  if (score < 80) return {
    band: 'جيد',
    color: 'text-sky-600',
    ring: 'ring-sky-300 from-sky-500/15',
    headline: 'أنت في مسار جيد — ركّز على ما يميّزك ويضاعف هامشك.',
    bullets: [
      'حوّل عرضك الأعلى ربحية إلى منتج قابل للتكرار.',
      'فعّل لوحة مؤشرات تجمع المالية والعمليات والمبيعات.',
      'خطّط لتوسّع جانبي بدون زيادة تكاليف ثابتة.',
    ],
  }
  return {
    band: 'متقدّم',
    color: 'text-emerald-600',
    ring: 'ring-emerald-300 from-emerald-500/15',
    headline: 'أداء قوي — وقت تعميق الميزة التنافسية والتوسّع.',
    bullets: [
      'استكشف توسّعاً جغرافياً أو في خط منتج جديد.',
      'فعّل لوحة قيادة مجلس إدارة + مراجعة فصلية رسمية.',
      'استثمر في تطوير القيادات وخطط التعاقب.',
    ],
  }
}

export function QuickCheckPage() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  function pick(points: number) {
    const q = QUESTIONS[step]
    const next = { ...answers, [q.key]: points }
    setAnswers(next)
    if (step + 1 < QUESTIONS.length) {
      setStep(step + 1)
    } else {
      setDone(true)
    }
  }

  function reset() {
    setStep(0)
    setAnswers({})
    setDone(false)
  }

  const score = Math.round(
    Object.values(answers).reduce((sum, p) => sum + p, 0) / Math.max(QUESTIONS.length, 1)
  )

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
        {!done ? (
          <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-primary" />
                تشخيص أولي مجاني · بدون تسجيل
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                أين تقف شركتك اليوم؟
              </h1>
              <p className="mt-3 text-muted-foreground">
                5 أسئلة سريعة، نتيجة فورية، بدون أي بيانات شخصية.
              </p>
            </div>

            {/* Progress */}
            <div className="mx-auto flex w-full max-w-md items-center gap-2">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-primary' : 'bg-secondary'}`}
                />
              ))}
            </div>
            <div className="text-center text-xs text-muted-foreground">
              السؤال {step + 1} من {QUESTIONS.length}
            </div>

            <Card className="bg-gradient-to-bl from-primary/5 to-violet-500/5">
              <CardHeader>
                <CardDescription>محور: {QUESTIONS[step].axis}</CardDescription>
                <CardTitle className="text-xl">{QUESTIONS[step].title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {QUESTIONS[step].choices.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => pick(c.points)}
                    className="group flex items-center justify-between rounded-xl border bg-card p-4 text-right text-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    <span className="font-medium">{c.label}</span>
                    <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground transition group-hover:border-primary group-hover:text-primary">
                      اختر
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>

            {step > 0 && (
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  ← السؤال السابق
                </Button>
              </div>
            )}
          </section>
        ) : (
          <ResultView score={score} answers={answers} onReset={reset} onSignup={() => navigate('/select-type')} />
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
  score,
  answers,
  onReset,
  onSignup,
}: {
  score: number
  answers: Record<string, number>
  onReset: () => void
  onSignup: () => void
}) {
  const band = bandFor(score)

  // أضعف 3 محاور للعرض
  const weakest = QUESTIONS
    .map((q) => ({ axis: q.axis, pct: answers[q.key] ?? 0 }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3)

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          نتيجتك الأولية
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {band.headline}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        {/* Score card */}
        <Card className={`md:col-span-5 bg-gradient-to-bl ${band.ring} to-transparent ring-1`}>
          <CardHeader>
            <CardDescription>درجة النضج المبدئية</CardDescription>
            <CardTitle className="flex items-baseline gap-2">
              <span className={`text-6xl font-bold tabular-nums ${band.color}`}>{score}</span>
              <span className="text-base text-muted-foreground">/ 100</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${band.color}`}>
              <span className="size-1.5 rounded-full bg-current" />
              {band.band}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              هذه نتيجة مبدئية على 5 أسئلة فقط — التحليل الكامل يغطّي 11 سؤالاً موزّناً ويقترح مسارك الاستراتيجي.
            </p>
          </CardContent>
        </Card>

        {/* Weakest axes */}
        <Card className="md:col-span-7 border-rose-200 bg-gradient-to-br from-rose-500/5 to-transparent">
          <CardHeader>
            <CardTitle>أبرز نقاط الضعف</CardTitle>
            <CardDescription>المحاور التي حصلت على أقل تقييم — ابدأ بها.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {weakest.map((w) => (
                <li
                  key={w.axis}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm"
                >
                  <span className="font-medium">{w.axis}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={w.pct < 40 ? 'h-full bg-rose-500' : w.pct < 70 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
                        style={{ width: `${w.pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{w.pct}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Action bullets */}
        <Card className="md:col-span-12 border-emerald-200 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader>
            <CardTitle>3 خطوات يمكنك البدء بها هذا الأسبوع</CardTitle>
            <CardDescription>إرشادات سريعة بناءً على نتيجتك. التحليل الكامل يعطيك خطة 90 يوماً مفصّلة.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm md:grid-cols-3">
              {band.bullets.map((b, i) => (
                <li key={i} className="rounded-xl border bg-card p-4">
                  <span className="ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="md:col-span-12 overflow-hidden">
          <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              احصل على التحليل الكامل + خطة 90 يوماً
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              التشخيص الكامل يحلّل 11 سؤالاً موزّناً، يحدّد مسارك الاستراتيجي من بين 5 مسارات،
              ويعطيك أبرز 4 إجراءات عاجلة + معاينة سيناريوهات. مجاني عند التسجيل.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button size="lg" onClick={onSignup}>
                ابدأ التحليل الكامل
              </Button>
              <Button variant="outline" size="lg" onClick={onReset}>
                إعادة التشخيص الأولي
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
