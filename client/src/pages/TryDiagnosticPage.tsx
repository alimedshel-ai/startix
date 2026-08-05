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
import {
  DEPT_OPTIONS, TEAM_SIZE_OPTIONS, EXPERIENCE_OPTIONS, OPERATIONAL_OPTIONS,
  TOOLING_OPTIONS, REPORTING_OPTIONS, DECISION_OPTIONS,
  PORTFOLIO_OPTIONS, STAGE_OPTIONS, CADENCE_OPTIONS,
  SECTOR_FOCUS_OPTIONS, INVOLVEMENT_OPTIONS, TICKET_SIZE_OPTIONS,
  type ManagerAnswers, type ManagerResult, type InvestorAnswers, type InvestorResult,
} from '@/lib/managerInvestorQuestions'
import { useDiagnosticStore, type DiagnosticRole } from '@/store/diagnosticStore'
import { useAuthStore } from '@/store/authStore'
import type { SpecialtyDeptType } from '@/types/user'

// مولّد سؤال راديو موحّد للمدير + المستثمر
type RadioStep<T extends string> = {
  key: string
  title: string
  options: { value: T; label: string }[]
}

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

// ─── 1. اختيار الدور ─────────────────────────────────────────────────────────

const ROLES: { value: DiagnosticRole; title: string; subtitle: string; icon: string; accent: string }[] = [
  {
    value: 'OWNER',
    title: 'صاحب شركة / مشروع',
    subtitle: 'تشخيص استراتيجي شامل — 9 أسئلة، يحدّد مسارك من 5 مسارات.',
    icon: '🏢',
    accent: 'from-primary/10 ring-primary/30',
  },
  {
    value: 'MANAGER',
    title: 'مدير قسم / إدارة',
    subtitle: 'تقييم 7 أسئلة لقدرات قسمك ونضج أدواته وحوكمته.',
    icon: '👔',
    accent: 'from-sky-500/10 ring-sky-300',
  },
  {
    value: 'INVESTOR',
    title: 'مستثمر',
    subtitle: '6 أسئلة لتقييم اتّساع محفظتك وانضباط متابعتها ومشاركتك.',
    icon: '📈',
    accent: 'from-amber-500/10 ring-amber-300',
  },
]

// ─── الصفحة الرئيسية ─────────────────────────────────────────────────────────

export function TryDiagnosticPage() {
  const role = useDiagnosticStore((s) => s.role)
  const setRole = useDiagnosticStore((s) => s.setRole)
  const reset = useDiagnosticStore((s) => s.reset)
  const ownerResult = useDiagnosticStore((s) => s.ownerResult)
  const managerResult = useDiagnosticStore((s) => s.managerResult)
  const investorResult = useDiagnosticStore((s) => s.investorResult)
  const hasPreviousResult = ownerResult != null || managerResult != null || investorResult != null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">س</div>
            <span className="text-lg font-semibold tracking-tight">ستارتكس</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* زرّ «بدء تشخيص جديد» — يظهر دائماً عند وجود جلسة سابقة */}
            {role !== null && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('سيُمسح تشخيصك الحالي (الإجابات + النتيجة). المتابعة؟')) reset()
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                🔄 بدء تشخيص جديد
              </button>
            )}
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              لديك حساب؟ تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {role === null ? (
          <RolePicker onPick={setRole} />
        ) : (
          <>
            {/* شارة إعادة الاختيار — تظهر أعلى المسار عند العودة لجلسة قائمة */}
            <ResumeBar
              role={role}
              hasResult={hasPreviousResult}
              onReset={() => {
                if (confirm('سيُمسح تشخيصك الحالي والنتيجة. المتابعة؟')) reset()
              }}
            />
            {role === 'OWNER' ? (
              <OwnerFlow onChangeRole={() => { reset() }} />
            ) : role === 'MANAGER' ? (
              <ManagerFlow onChangeRole={() => { reset() }} />
            ) : (
              <InvestorFlow onChangeRole={() => { reset() }} />
            )}
          </>
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

// ─── شريط استئناف — يظهر أعلى المسار عند وجود جلسة سابقة ───────
function ResumeBar({
  role, hasResult, onReset,
}: { role: DiagnosticRole; hasResult: boolean; onReset: () => void }) {
  const roleLabel = role === 'OWNER' ? 'صاحب أعمال' : role === 'MANAGER' ? 'مدير' : 'مستثمر'
  return (
    <div className="border-b bg-gradient-to-l from-sky-50 to-transparent">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-6 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 font-bold text-sky-800">
            {hasResult ? '✓ لديك تشخيص محفوظ' : '⏳ لديك جلسة قيد التقدّم'}
          </span>
          <span className="text-muted-foreground">
            النشاط الحاليّ: <b className="text-foreground">{roleLabel}</b>
            {hasResult ? ' — النتيجة جاهزة أدناه.' : ' — استمرّ من حيث توقّفت أو ابدأ من جديد.'}
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-sky-400 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 transition hover:bg-sky-50"
        >
          🔄 اختر نشاطاً آخر
        </button>
      </div>
    </div>
  )
}

function RolePicker({ onPick }: { onPick: (r: DiagnosticRole) => void }) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          تشخيص مجاني · بدون تسجيل
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          ما هو دورك الأساسي؟
        </h1>
        <p className="mt-3 text-muted-foreground">
          نخصّص الأسئلة والنتيجة حسب دورك. النتيجة تنحفظ تلقائياً في حسابك عند التسجيل.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => onPick(r.value)}
            className={`group flex flex-col items-start gap-2 rounded-2xl border bg-gradient-to-bl ${r.accent} to-transparent p-5 text-right shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="text-3xl">{r.icon}</div>
            <div className="font-semibold">{r.title}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{r.subtitle}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
              ابدأ →
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   1) المالك — يستعمل العقل الكامل من server/services/diagnosticEngine
// ═══════════════════════════════════════════════════════════════════════════

// ─── جوهر قصير + عمق اختياريّ (تقليل عدد أسئلة التشخيص المبدئيّ) ──────────
// الجوهر: الهوية + ٤ أسئلة تكفي لنتيجةٍ فوريّة (المرحلة · الحجم · التتبّع الماليّ
// · السيولة — إشارتان ماليّتان تقودان توصية المسار). العمق: ٤ أسئلة اختياريّة
// «للدقّة» يمكن تخطّيها؛ عند التخطّي تُملأ بقيمٍ حياديّة (لا تنفخ النتيجة) فتبقى
// دورة الحفظ (draft → API) كاملةً دون أيّ تغيير في محرّك الخادم.
const OWNER_CORE_KEYS = ['stage', 'size', 'financialTracking', 'liquidity'] as const
const OWNER_DEPTH_KEYS = ['ownerDependency', 'governance', 'scalability', 'exitStrategy'] as const
const OWNER_CORE_QUESTIONS = OWNER_CORE_KEYS.map((k) => OWNER_QUESTIONS.find((q) => q.key === k)!)
const OWNER_DEPTH_QUESTIONS = OWNER_DEPTH_KEYS.map((k) => OWNER_QUESTIONS.find((q) => q.key === k)!)
const OWNER_ORDERED_QUESTIONS = [...OWNER_CORE_QUESTIONS, ...OWNER_DEPTH_QUESTIONS]
// قيمٌ حياديّة (متوسّطة، لا مثاليّة ولا متعثّرة) للعمق المُتخطَّى — لا تُحابي النتيجة.
const OWNER_DEPTH_DEFAULTS: Pick<OwnerAnswers, (typeof OWNER_DEPTH_KEYS)[number]> = {
  ownerDependency: 'high', governance: 'partial', scalability: 'mid', exitStrategy: 'none',
}

function OwnerFlow({ onChangeRole }: { onChangeRole: () => void }) {
  const navigate = useNavigate()
  const draft = useDiagnosticStore((s) => s.ownerDraft)
  const step = useDiagnosticStore((s) => s.ownerStep)
  const result = useDiagnosticStore((s) => s.ownerResult)
  const setDraft = useDiagnosticStore((s) => s.setOwnerDraft)
  const setStep = useDiagnosticStore((s) => s.setOwnerStep)
  const setResult = useDiagnosticStore((s) => s.setOwnerResult)
  const markPendingPersist = useDiagnosticStore((s) => s.markPendingPersist)
  const [submitting, setSubmitting] = useState(false)
  // هل اختار المستخدم إضافة أسئلة الدقّة (العمق)؟ افتراضاً: الجوهر فقط.
  const [wantsDepth, setWantsDepth] = useState(false)

  const CORE_STEPS = 1 + OWNER_CORE_QUESTIONS.length // الهوية + الجوهر
  const totalSteps = wantsDepth ? 1 + OWNER_ORDERED_QUESTIONS.length : CORE_STEPS
  const progress = Math.round(((step + 1) / totalSteps) * 100)
  const isIdentificationStep = step === 0
  const question = isIdentificationStep ? null : OWNER_ORDERED_QUESTIONS[step - 1]
  const currentValue = question
    ? (draft[question.key as keyof OwnerAnswers] as string | undefined)
    : undefined
  const canAdvance = isIdentificationStep
    ? Boolean(draft.companyName && draft.sector)
    : Boolean(currentValue)
  const isLastCoreStep = step === CORE_STEPS - 1 // آخر خطوة جوهر — نقطة قرار «احسب الآن / أضِف دقّة»
  const isDepthStep = step > CORE_STEPS - 1       // خطوةٌ من العمق الاختياريّ
  const atEnd = step === totalSteps - 1

  async function submit() {
    setSubmitting(true)
    try {
      // املأ العمق المُتخطَّى بقيمٍ حياديّة، وثبّتها في المسودّة لتبقى دورة الحفظ كاملة.
      // بناءٌ عبر fromEntries (قالبٌ واحد عند الحدّ) — الكتابة المباشرة patch[k]
      // عبر مفتاحٍ اتّحاديّ يرفضها TS (تقاطع أنواع القيم = never).
      const patch = Object.fromEntries(
        OWNER_DEPTH_KEYS.filter((k) => draft[k] == null).map((k) => [k, OWNER_DEPTH_DEFAULTS[k]]),
      ) as Partial<OwnerAnswers>
      if (Object.keys(patch).length > 0) setDraft(patch)
      const full = { ...draft, ...patch }
      const { data } = await api.post<{ result: OwnerDiagnosticResult }>('/api/diagnostic/preview', full)
      setResult(data.result)
      markPendingPersist()
      toast.success('اكتمل التشخيص — نتيجتك جاهزة')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'تعذّر حساب النتيجة'))
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (step < totalSteps - 1) {
      setStep(step + 1)
      return
    }
    submit()
  }

  if (result) {
    return <OwnerResultView result={result} onSave={() => navigate('/select-type?role=OWNER')} onReset={onChangeRole} />
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <RoleHeader title="تشخيص المالك" subtitle={`جوهر ${CORE_STEPS} خطوات · نتيجة فورية${wantsDepth ? ` + ${OWNER_DEPTH_QUESTIONS.length} للدقّة` : ''}`} onChangeRole={onChangeRole} />

      <Card className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-rose-500" />
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>الخطوة {step + 1} من {totalSteps}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <CardTitle className="mt-3 flex items-center gap-2">
            {isIdentificationStep ? 'معلومات الشركة' : question!.label}
            {isDepthStep && (
              <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                اختياريّ · للدقّة
              </span>
            )}
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
                <Input id="companyName" value={draft.companyName ?? ''} onChange={(e) => setDraft({ companyName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sector">القطاع</Label>
                <Input id="sector" placeholder="تجزئة، خدمات، تقنية، تصنيع…" value={draft.sector ?? ''} onChange={(e) => setDraft({ sector: e.target.value })} />
              </div>
            </>
          ) : (
            question && (
              <RadioGroup
                value={currentValue ?? ''}
                onValueChange={(v) => setDraft({ [question.key]: v } as Partial<OwnerAnswers>)}
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

        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0 || submitting}>
            السابق
          </Button>
          {isLastCoreStep && !wantsDepth ? (
            // نقطة القرار: نتيجةٌ فوريّة بالجوهر، أو إضافة أسئلة الدقّة.
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => { setWantsDepth(true); setStep(step + 1) }}
                disabled={!canAdvance || submitting}
              >
                أضِف دقّة ({OWNER_DEPTH_QUESTIONS.length} أسئلة) ←
              </Button>
              <Button onClick={submit} disabled={!canAdvance || submitting}>
                {submitting ? 'جاري الحساب…' : 'احسب النتيجة الآن'}
              </Button>
            </div>
          ) : (
            <Button onClick={next} disabled={!canAdvance || submitting}>
              {submitting ? 'جاري الحساب…' : atEnd ? 'عرض النتيجة' : 'التالي'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </section>
  )
}

function OwnerResultView({ result, onSave, onReset }: { result: OwnerDiagnosticResult; onSave: () => void; onReset: () => void }) {
  const radarTranslated = result.radarData.map((r) => ({ axis: AXIS_LABEL_AR[r.axis] ?? r.axis, value: r.value }))
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <ResultHeader title="مسارك الاستراتيجي + خريطة الـ 90 يوماً" />
      <div className="grid gap-4 md:grid-cols-12">
        <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-transparent md:col-span-5">
          <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
          <CardHeader>
            <CardDescription>المسار الاستراتيجي الموصى به</CardDescription>
            <CardTitle className="flex items-center gap-3"><PathBadge path={result.strategicPath} /></CardTitle>
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
          <CardContent><RadarChart data={radarTranslated} /></CardContent>
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
                  <span className="ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
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
            <CardDescription>نتيجتان محتملتان لمسار {pathLabel(result.strategicPath)}.</CardDescription>
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

        <SaveCta onSave={onSave} onReset={onReset} />
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   2) المدير — 5 أسئلة، نتيجة قياس قدرات قسم
// ═══════════════════════════════════════════════════════════════════════════

// 7 أسئلة كلها راديو
const MANAGER_QUESTIONS: RadioStep<string>[] = [
  { key: 'departmentType', title: 'أي قسم تديره؟', options: DEPT_OPTIONS as { value: string; label: string }[] },
  { key: 'teamSize', title: 'ما حجم فريقك المباشر؟', options: TEAM_SIZE_OPTIONS as { value: string; label: string }[] },
  { key: 'experienceLevel', title: 'ما مستوى خبرتك في هذا المجال؟', options: EXPERIENCE_OPTIONS as { value: string; label: string }[] },
  { key: 'operationalMaturity', title: 'ما مستوى نضج إجراءات قسمك؟', options: OPERATIONAL_OPTIONS as { value: string; label: string }[] },
  { key: 'toolingMaturity', title: 'ما مستوى نضج أدواتك الرقمية؟', options: TOOLING_OPTIONS as { value: string; label: string }[] },
  { key: 'reportingQuality', title: 'ما جودة التقارير والمتابعة في قسمك؟', options: REPORTING_OPTIONS as { value: string; label: string }[] },
  { key: 'decisionAuthority', title: 'ما مستوى استقلالية القرارات في دورك؟', options: DECISION_OPTIONS as { value: string; label: string }[] },
]
const MANAGER_STEPS = MANAGER_QUESTIONS.length

function ManagerFlow({ onChangeRole }: { onChangeRole: () => void }) {
  const navigate = useNavigate()
  const managerType = useDiagnosticStore((s) => s.managerType)
  const setManagerType = useDiagnosticStore((s) => s.setManagerType)
  const draft = useDiagnosticStore((s) => s.managerDraft)
  const step = useDiagnosticStore((s) => s.managerStep)
  const result = useDiagnosticStore((s) => s.managerResult)
  const setDraft = useDiagnosticStore((s) => s.setManagerDraft)
  const setStep = useDiagnosticStore((s) => s.setManagerStep)
  const setResult = useDiagnosticStore((s) => s.setManagerResult)
  const markPendingPersist = useDiagnosticStore((s) => s.markPendingPersist)
  const setSelectedType = useAuthStore((s) => s.setSelectedType)
  const setSelectedManagerType = useAuthStore((s) => s.setSelectedManagerType)
  const setSelectedSpecialty = useAuthStore((s) => s.setSelectedSpecialty)
  const [submitting, setSubmitting] = useState(false)

  // خطوة صفرية قبل الـ 7 أسئلة: تحديد نوع المدير. لا تُرسل للمحرّك — تُستهلك
  // فقط لضبط تدفّق التسجيل ولتصفية /manager/select-dept لاحقاً.
  if (!managerType && !result) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
        <RoleHeader title="تشخيص المدير" subtitle="سؤال تمهيدي واحد قبل التقييم" onChangeRole={onChangeRole} />
        <Card className="overflow-hidden shadow-sm">
          <div className="h-1.5 bg-gradient-to-l from-sky-500 to-indigo-500" />
          <CardHeader>
            <CardTitle>هل أنت مدير داخلي أم مدير مستقل؟</CardTitle>
            <CardDescription className="leading-relaxed">
              المدير الداخلي يعمل داخل شركة واحدة. المدير المستقل خبير تخصّص واحد يخدم عملاء متعدّدين.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setManagerType('INTERNAL')}
              className="flex flex-col items-start gap-1 rounded-xl border bg-card p-4 text-right transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <span className="text-2xl" aria-hidden>🏢</span>
              <span className="font-semibold">مدير داخلي</span>
              <span className="text-xs text-muted-foreground">تدير قسماً داخل شركتك.</span>
            </button>
            <button
              onClick={() => setManagerType('INDEPENDENT_PRO')}
              className="flex flex-col items-start gap-1 rounded-xl border bg-card p-4 text-right transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <span className="text-2xl" aria-hidden>🤝</span>
              <span className="font-semibold">مدير مستقل</span>
              <span className="text-xs text-muted-foreground">خبير تخصّص يخدم عدّة عملاء.</span>
            </button>
          </CardContent>
        </Card>
      </section>
    )
  }

  const progress = Math.round(((step + 1) / MANAGER_STEPS) * 100)
  const q = MANAGER_QUESTIONS[step]
  const currentValue = draft[q.key as keyof ManagerAnswers] as string | undefined
  const canAdvance = Boolean(currentValue)

  async function submit() {
    setSubmitting(true)
    try {
      const { data } = await api.post<{ result: ManagerResult }>('/api/diagnostic/preview/manager', draft)
      setResult(data.result)
      markPendingPersist()
      toast.success('اكتمل التقييم — نتيجتك جاهزة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر حساب النتيجة'))
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (step < MANAGER_STEPS - 1) {
      setStep(step + 1)
      return
    }
    submit()
  }

  // عند حفظ النتيجة نضخّ الاختيارات في authStore حتى يتخطّى /select-type
  // الأسئلة ويقفز مباشرة لصفحة التسجيل بالحقول الصحيحة.
  const persistToAuth = () => {
    setSelectedType('MANAGER')
    setSelectedManagerType(managerType)
    if (managerType === 'INDEPENDENT_PRO') {
      const dept = draft.departmentType as SpecialtyDeptType | undefined
      if (dept) setSelectedSpecialty(dept)
    } else {
      setSelectedSpecialty(null)
    }
    navigate('/select-type?role=MANAGER')
  }

  if (result) {
    return <ManagerResultView result={result} onSave={persistToAuth} onReset={onChangeRole} />
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <RoleHeader
        title="تشخيص المدير"
        subtitle={`${MANAGER_STEPS} خطوات · ${managerType === 'INDEPENDENT_PRO' ? 'مستقل' : 'داخلي'}`}
        onChangeRole={onChangeRole}
      />
      <Card className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 to-indigo-500" />
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>الخطوة {step + 1} من {MANAGER_STEPS}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <CardTitle className="mt-3">{q.title}</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          <RadioGroup
            value={currentValue ?? ''}
            onValueChange={(v) => setDraft({ [q.key]: v } as Partial<ManagerAnswers>)}
            className={`grid gap-2 ${q.options.length > 4 ? 'sm:grid-cols-2' : ''}`}
          >
            {q.options.map((o) => (
              <Label
                key={o.value}
                htmlFor={`m-${q.key}-${o.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:bg-accent hover:shadow-sm"
              >
                <RadioGroupItem id={`m-${q.key}-${o.value}`} value={o.value} />
                <span className="text-sm leading-snug">{o.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0 || submitting}>السابق</Button>
          <Button onClick={next} disabled={!canAdvance || submitting}>
            {submitting ? 'جاري الحساب…' : step === MANAGER_STEPS - 1 ? 'عرض النتيجة' : 'التالي'}
          </Button>
        </CardFooter>
      </Card>
    </section>
  )
}

function ManagerResultView({ result, onSave, onReset }: { result: ManagerResult; onSave: () => void; onReset: () => void }) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <ResultHeader title={`نتيجتك في قسم ${result.departmentLabel}`} />
      <div className="grid gap-4 md:grid-cols-12">
        <ScoreCard band={result.band} score={result.overallScore} colorClass={managerBandColor(result.band)} />

        <Card className="bg-gradient-to-br from-sky-500/5 to-indigo-500/5 md:col-span-7">
          <CardHeader>
            <CardTitle>محاور الأداء</CardTitle>
            <CardDescription>الفريق · الأدوات · الخبرة — كل محور 0–100.</CardDescription>
          </CardHeader>
          <CardContent>
            <InsightsList insights={result.insights} />
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/5 to-transparent md:col-span-12">
          <CardHeader>
            <CardTitle>توصياتك</CardTitle>
            <CardDescription>الخطوات الأكثر فعالية بناءً على نتيجتك.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm md:grid-cols-2">
              {result.recommendations.map((r, i) => (
                <li key={i} className="rounded-xl border bg-card p-3">
                  <span className="ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="font-medium">{r.title}.</span>{' '}
                  <span className="text-muted-foreground">{r.detail}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <SaveCta onSave={onSave} onReset={onReset} />
      </div>
    </section>
  )
}

function managerBandColor(b: ManagerResult['band']): string {
  if (b === 'متعثّر') return 'text-rose-600'
  if (b === 'يحتاج تطوير') return 'text-amber-600'
  if (b === 'فعّال') return 'text-sky-600'
  return 'text-emerald-600'
}

// ═══════════════════════════════════════════════════════════════════════════
//   3) المستثمر — 3 أسئلة
// ═══════════════════════════════════════════════════════════════════════════

// 6 أسئلة كلها راديو
const INVESTOR_QUESTIONS: RadioStep<string>[] = [
  { key: 'portfolioSize', title: 'كم شركة في محفظتك حالياً؟', options: PORTFOLIO_OPTIONS as { value: string; label: string }[] },
  { key: 'investmentStage', title: 'في أي مرحلة تستثمر بشكل رئيسي؟', options: STAGE_OPTIONS as { value: string; label: string }[] },
  { key: 'monitoringCadence', title: 'كم مرّة تراجع أداء شركات المحفظة؟', options: CADENCE_OPTIONS as { value: string; label: string }[] },
  { key: 'sectorFocus', title: 'ما طبيعة تركيزك القطاعي؟', options: SECTOR_FOCUS_OPTIONS as { value: string; label: string }[] },
  { key: 'involvementType', title: 'ما مستوى تورّطك في شركات المحفظة؟', options: INVOLVEMENT_OPTIONS as { value: string; label: string }[] },
  { key: 'ticketSize', title: 'ما متوسط حجم تذكرة الاستثمار؟', options: TICKET_SIZE_OPTIONS as { value: string; label: string }[] },
]
const INVESTOR_STEPS = INVESTOR_QUESTIONS.length

function InvestorFlow({ onChangeRole }: { onChangeRole: () => void }) {
  const navigate = useNavigate()
  const draft = useDiagnosticStore((s) => s.investorDraft)
  const step = useDiagnosticStore((s) => s.investorStep)
  const result = useDiagnosticStore((s) => s.investorResult)
  const setDraft = useDiagnosticStore((s) => s.setInvestorDraft)
  const setStep = useDiagnosticStore((s) => s.setInvestorStep)
  const setResult = useDiagnosticStore((s) => s.setInvestorResult)
  const markPendingPersist = useDiagnosticStore((s) => s.markPendingPersist)
  const [submitting, setSubmitting] = useState(false)

  const progress = Math.round(((step + 1) / INVESTOR_STEPS) * 100)
  const q = INVESTOR_QUESTIONS[step]
  const currentValue = draft[q.key as keyof InvestorAnswers] as string | undefined
  const canAdvance = Boolean(currentValue)

  async function submit() {
    setSubmitting(true)
    try {
      const { data } = await api.post<{ result: InvestorResult }>('/api/diagnostic/preview/investor', draft)
      setResult(data.result)
      markPendingPersist()
      toast.success('اكتمل التقييم — نتيجتك جاهزة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر حساب النتيجة'))
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (step < INVESTOR_STEPS - 1) {
      setStep(step + 1)
      return
    }
    submit()
  }

  if (result) {
    return <InvestorResultView result={result} onSave={() => navigate('/select-type?role=INVESTOR')} onReset={onChangeRole} />
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <RoleHeader title="تشخيص المستثمر" subtitle={`${INVESTOR_STEPS} خطوات · نتيجة فورية`} onChangeRole={onChangeRole} />
      <Card className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-amber-500 to-orange-500" />
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>الخطوة {step + 1} من {INVESTOR_STEPS}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <CardTitle className="mt-3">{q.title}</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          <RadioGroup
            value={currentValue ?? ''}
            onValueChange={(v) => setDraft({ [q.key]: v } as Partial<InvestorAnswers>)}
            className={`grid gap-2 ${q.options.length > 3 ? 'sm:grid-cols-2' : ''}`}
          >
            {q.options.map((o) => (
              <Label
                key={o.value}
                htmlFor={`i-${q.key}-${o.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:bg-accent hover:shadow-sm"
              >
                <RadioGroupItem id={`i-${q.key}-${o.value}`} value={o.value} />
                <span className="text-sm leading-snug">{o.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0 || submitting}>السابق</Button>
          <Button onClick={next} disabled={!canAdvance || submitting}>
            {submitting ? 'جاري الحساب…' : step === INVESTOR_STEPS - 1 ? 'عرض النتيجة' : 'التالي'}
          </Button>
        </CardFooter>
      </Card>
    </section>
  )
}

function InvestorResultView({ result, onSave, onReset }: { result: InvestorResult; onSave: () => void; onReset: () => void }) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <ResultHeader title="ملف محفظتك الاستثمارية" />
      <div className="grid gap-4 md:grid-cols-12">
        <ScoreCard band={result.band} score={result.overallScore} colorClass={investorBandColor(result.band)} />

        <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 md:col-span-7">
          <CardHeader>
            <CardTitle>محاور الأداء</CardTitle>
            <CardDescription>{result.riskAppetiteLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <InsightsList insights={result.insights} />
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/5 to-transparent md:col-span-12">
          <CardHeader>
            <CardTitle>توصياتك</CardTitle>
            <CardDescription>تحسينات سريعة لتطوير منهجية استثمارك.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm md:grid-cols-2">
              {result.recommendations.map((r, i) => (
                <li key={i} className="rounded-xl border bg-card p-3">
                  <span className="ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="font-medium">{r.title}.</span>{' '}
                  <span className="text-muted-foreground">{r.detail}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <SaveCta onSave={onSave} onReset={onReset} />
      </div>
    </section>
  )
}

function investorBandColor(b: InvestorResult['band']): string {
  if (b === 'مبتدئ') return 'text-rose-600'
  if (b === 'متطوّر') return 'text-amber-600'
  if (b === 'متقدّم') return 'text-sky-600'
  return 'text-emerald-600'
}

// ═══════════════════════════════════════════════════════════════════════════
//   مكوّنات مشتركة
// ═══════════════════════════════════════════════════════════════════════════

function RoleHeader({ title, subtitle, onChangeRole }: { title: string; subtitle: string; onChangeRole: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onChangeRole}>تغيير الدور</Button>
    </div>
  )
}

function ResultHeader({ title }: { title: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-primary" />
        نتيجتك
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
    </div>
  )
}

function ScoreCard({ band, score, colorClass }: { band: string; score: number; colorClass: string }) {
  return (
    <Card className="md:col-span-5 bg-gradient-to-bl from-primary/10 to-transparent ring-1 ring-primary/20">
      <CardHeader>
        <CardDescription>درجة النضج المبدئية</CardDescription>
        <CardTitle className="flex items-baseline gap-2">
          <span className={`text-6xl font-bold tabular-nums ${colorClass}`}>{score}</span>
          <span className="text-base text-muted-foreground">/ 100</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${colorClass}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {band}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          هذه نتيجة مبدئية — التحليل الكامل بعد التسجيل يفتح لك أدوات أعمق ولوحات قيادة مخصّصة.
        </p>
      </CardContent>
    </Card>
  )
}

function InsightsList({ insights }: { insights: { axis: string; pct: number }[] }) {
  return (
    <ul className="grid gap-3">
      {insights.map((w) => (
        <li key={w.axis} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
          <span className="font-medium">{w.axis}</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
              <div className={w.pct < 40 ? 'h-full bg-rose-500' : w.pct < 70 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'} style={{ width: `${w.pct}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{w.pct}%</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function SaveCta({ onSave, onReset }: { onSave: () => void; onReset: () => void }) {
  return (
    <Card className="md:col-span-12 overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">احفظ نتيجتك في حسابك</h2>
        <p className="max-w-2xl text-muted-foreground">
          سجّل حساباً مجانياً وسنحفظ تقييمك تلقائياً. ستحصل على لوحات قيادة، أدوات تحليل عميقة، وتقارير قابلة للتصدير.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button size="lg" onClick={onSave}>سجّل حساب وحفظ النتيجة</Button>
          <Button variant="outline" size="lg" onClick={onReset}>إعادة التشخيص</Button>
        </div>
        <p className="text-xs text-muted-foreground">نتيجتك محفوظة محلياً في متصفّحك حتى تسجّل.</p>
      </CardContent>
    </Card>
  )
}
