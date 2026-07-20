import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { landingAfterOnboarding } from '@/components/layouts/nav'
import { applyPendingMaturity } from '@/lib/maturityCarryover'
import { MATURITY_CONFIGS } from '@/lib/maturityConfigs'
import { api, apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { EXPERIENCE_OPTIONS, TEAM_SIZE_OPTIONS, TOOLING_OPTIONS } from '@/lib/managerInvestorQuestions'
import { ONBOARDING_GOALS, ONBOARDING_PAINS } from '@/lib/onboardingOptions'
import type { GoalCode, PainCode } from '@/types/user'
import { useAuthStore } from '@/store/authStore'
import { useDiagnosticStore } from '@/store/diagnosticStore'
import type { OpexData, StrategyPath, User } from '@/types/user'

// ─── R1.3 — /onboarding: 4 شرائح بعد التسجيل ────────────────────────
// الشرائح: الهوية+OPEX → الآلام → الأهداف → المسار الاستراتيجي.
// كل شريحة اختيارية (يمكن التخطّي). يحفظ عبر POST /api/auth/onboarding.
//
// المنطق:
//   • Owner: الآلام → الأهداف → المسار (بلا شريحة الهوية).
//   • Manager INTERNAL: نفس Owner.
//   • Manager INDEPENDENT_PRO: الأربع كاملة.
//   • Investor: نفس Owner (بلا OPEX).

type SlideId = 'identity' | 'pains' | 'goals' | 'path'

interface FormState {
  sector?: string
  subsector?: string
  entityType?: string
  size?: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
  opex: OpexData
  pains: string[]
  goals: string[]
  strategyPath?: StrategyPath
}

const EMPTY: FormState = { opex: {}, pains: [], goals: [] }

// ─── خريطة الآلام الشائعة لكل تخصّص (top 3) ─────────────────────
const SPECIALTY_TOP_PAINS: Record<DeptCode, PainCode[]> = {
  HR:               ['team_lost', 'no_alignment', 'no_time'],
  FINANCE:          ['no_data', 'no_budget', 'no_kpis'],
  SALES:            ['no_kpis', 'no_data', 'no_alignment'],
  MARKETING:        ['no_data', 'no_kpis', 'no_budget'],
  OPERATIONS:       ['no_alignment', 'no_time', 'no_data'],
  IT:               ['no_data', 'no_time', 'no_budget'],
  CUSTOMER_SERVICE: ['team_lost', 'no_alignment', 'no_kpis'],
  SUPPORT:          ['no_time', 'team_lost', 'no_kpis'],
  LOGISTICS:        ['no_alignment', 'no_data', 'no_time'],
  QUALITY:          ['no_kpis', 'no_data', 'no_alignment'],
  PROJECTS:         ['no_alignment', 'no_time', 'team_lost'],
  GOVERNANCE:       ['no_alignment', 'no_data', 'no_kpis'],
  COMPLIANCE:       ['no_data', 'no_time', 'no_kpis'],
}

// ─── خريطة الأهداف الشائعة لكل تخصّص (top 3) ────────────────────
const SPECIALTY_TOP_GOALS: Record<DeptCode, GoalCode[]> = {
  HR:               ['team', 'alignment', 'kpis'],
  FINANCE:          ['kpis', 'reports', 'improve'],
  SALES:            ['kpis', 'plan', 'improve'],
  MARKETING:        ['kpis', 'plan', 'improve'],
  OPERATIONS:       ['kpis', 'alignment', 'improve'],
  IT:               ['kpis', 'reports', 'improve'],
  CUSTOMER_SERVICE: ['kpis', 'team', 'improve'],
  SUPPORT:          ['kpis', 'team', 'improve'],
  LOGISTICS:        ['kpis', 'alignment', 'improve'],
  QUALITY:          ['kpis', 'reports', 'improve'],
  PROJECTS:         ['plan', 'alignment', 'kpis'],
  GOVERNANCE:       ['reports', 'alignment', 'swot'],
  COMPLIANCE:       ['reports', 'kpis', 'alignment'],
}

// شريحة ٤: خيارات المسار الاستراتيجي.
const PATH_OPTIONS: {
  code: StrategyPath
  icon: string
  labelAr: string
  timeAr: string
  focusAr: string
  stagesAr: string
  toolsAr: string
  colorClass: string
}[] = [
  {
    code: 'QUICK',
    icon: '⚡',
    labelAr: 'تشغيلي (قصير الأمد)',
    timeAr: '٠–٣ شهور',
    focusAr: 'تشخيص + مبادرات فورية — تنفيذ يومي',
    stagesAr: 'المراحل: ① ② ⑤ ⑥',
    toolsAr: '~٣ أدوات أساسية',
    colorClass: 'border-amber-400 hover:border-amber-500 bg-amber-50/40',
  },
  {
    code: 'MEDIUM',
    icon: '🎯',
    labelAr: 'تكتيكي (متوسّط الأمد)',
    timeAr: '٣–١٢ شهر',
    focusAr: 'تشخيص + توليف + توجّه + مبادرات — قرارات ربعيّة',
    stagesAr: 'المراحل: ① ② ③ ⑤ ⑥',
    toolsAr: '~٦ أدوات أساسية',
    colorClass: 'border-sky-400 hover:border-sky-500 bg-sky-50/40',
  },
  {
    code: 'LONG',
    icon: '🔭',
    labelAr: 'استراتيجي (طويل الأمد)',
    timeAr: '١٢–٣٦+ شهر',
    focusAr: 'الرحلة الاستراتيجيّة الكاملة — رؤية متعدّدة السنوات',
    stagesAr: 'المراحل: كلها ①→⑥',
    toolsAr: 'كل الأدوات',
    colorClass: 'border-purple-400 hover:border-purple-500 bg-purple-50/40',
  },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clearDraft = useAuthStore((s) => s.clearOnboardingDraft)
  const draft = useAuthStore((s) => s.onboardingDraft)
  // 📥 قراءة بيانات التشخيص السابق (guest) — نستعملها لتخصيص الأسئلة
  const diagnosticManagerDraft = useDiagnosticStore((s) => s.managerDraft)
  const diagnosticRole = useDiagnosticStore((s) => s.role)

  // نقل مسودّة تقييم النضج (قبل التسجيل) إلى أوّل عميل — مرّة واحدة بعد التسجيل.
  useEffect(() => {
    void applyPendingMaturity(user, MATURITY_CONFIGS)
  }, [user])

  // Pre-select آلام/أهداف حسب التخصّص إن لم يكن هناك تحديد سابق
  const specialty = user?.specialtyDeptType ?? null
  const topPainsForSpecialty = specialty ? SPECIALTY_TOP_PAINS[specialty] : []
  const topGoalsForSpecialty = specialty ? SPECIALTY_TOP_GOALS[specialty] : []

  // ─── تخطّي التكرار: حجم المنشأة + عدد الفريق من التشخيص السابق ───
  // teamSize في التشخيص (micro/small/medium/large) يُطابق size في Onboarding
  // (MICRO/SMALL/MEDIUM/LARGE) — نقلب الحالة تلقائياً بدل سؤالها مرّة أخرى.
  const teamSizeFromDx = diagnosticManagerDraft.teamSize
  const sizeFromDx: FormState['size'] | undefined =
    teamSizeFromDx === 'micro'  ? 'MICRO'
    : teamSizeFromDx === 'small'  ? 'SMALL'
    : teamSizeFromDx === 'medium' ? 'MEDIUM'
    : teamSizeFromDx === 'large'  ? 'LARGE'
    : undefined
  // متوسّط عدد الفريق من نطاق التشخيص (تقدير لبدء KPIs — يعدّله المستخدم لو أراد)
  const teamCountFromDx: number | undefined =
    teamSizeFromDx === 'micro'  ? 3
    : teamSizeFromDx === 'small'  ? 15
    : teamSizeFromDx === 'medium' ? 60
    : teamSizeFromDx === 'large'  ? 150
    : undefined

  const [state, setState] = useState<FormState>(() => ({
    ...EMPTY,
    ...draft.firstClientMeta,
    size: draft.firstClientMeta?.size ?? sizeFromDx, // من التشخيص إن وُجد
    opex: {
      ...(draft.firstClientMeta?.opex ?? {}),
      team: draft.firstClientMeta?.opex?.team ?? teamCountFromDx, // متوسّط من التشخيص
    },
    pains: draft.pains && draft.pains.length > 0
      ? draft.pains
      : topPainsForSpecialty.slice(0, 2),
    goals: draft.goals && draft.goals.length > 0
      ? draft.goals
      : topGoalsForSpecialty.slice(0, 2),
  }))
  const [saving, setSaving] = useState(false)

  const showIdentity = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  // بيانات التشخيص المطابِقة لدور المستخدم الحاليّ
  const hasDiagnosticData = diagnosticRole === user?.userType && (
    (user?.userType === 'MANAGER' && Object.keys(diagnosticManagerDraft).length > 0) ||
    diagnosticRole === user?.userType
  )
  const specialtyLabel = user?.specialtyDeptType ? DEPT_LABEL[user.specialtyDeptType] : null
  const managerTypeLabel = user?.managerType === 'INDEPENDENT_PRO'
    ? 'مدير مستقلّ (Independent Pro)'
    : user?.managerType === 'INTERNAL' ? 'مدير داخليّ' : null
  const teamSizeLabel = TEAM_SIZE_OPTIONS.find((o) => o.value === diagnosticManagerDraft.teamSize)?.label
  const experienceLabel = EXPERIENCE_OPTIONS.find((o) => o.value === diagnosticManagerDraft.experienceLevel)?.label
  const toolingLabel = TOOLING_OPTIONS.find((o) => o.value === diagnosticManagerDraft.toolingMaturity)?.label
  // شريحة «path» تظهر لكل الأدوار — كلٌّ منهم يختار طموحه الاستراتيجي.
  const slides = useMemo<SlideId[]>(
    () => (showIdentity ? ['identity', 'pains', 'goals', 'path'] : ['pains', 'goals', 'path']),
    [showIdentity],
  )
  const [step, setStep] = useState(0)
  const currentSlide = slides[step]
  const isLast = step === slides.length - 1

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">جاري التحميل…</p>
      </div>
    )
  }

  function togglePain(code: string) {
    setState((prev) => ({
      ...prev,
      pains: prev.pains.includes(code)
        ? prev.pains.filter((c) => c !== code)
        : [...prev.pains, code],
    }))
  }
  function toggleGoal(code: string) {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.includes(code)
        ? prev.goals.filter((c) => c !== code)
        : [...prev.goals, code],
    }))
  }
  function setOpex<K extends keyof OpexData>(key: K, raw: string) {
    const num = raw === '' ? undefined : Number(raw)
    const value = Number.isFinite(num) ? num : undefined
    setState((prev) => ({ ...prev, opex: { ...prev.opex, [key]: value } }))
  }

  async function submit() {
    setSaving(true)
    try {
      const payload = {
        pains: state.pains,
        goals: state.goals,
        strategyPath: state.strategyPath,
        // القطاع والحجم أُدخِلا في التسجيل — هنا نُثري OPEX فقط (Prisma يتجاهل
        // الحقول المحذوفة فلا يُمسح القطاع/الحجم القادمان من التسجيل).
        firstCompany: showIdentity ? { opex: state.opex } : undefined,
      }
      const { data } = await api.post<{ user: User }>('/api/auth/onboarding', payload)
      setUser(data.user)
      clearDraft()
      toast.success('تم حفظ بياناتك — أهلاً بك.')
      // §١ — المدير المستقل يهبط مباشرة على تدقيق إدارته (المرحلة ①).
      navigate(landingAfterOnboarding(data.user), { replace: true })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function skip() {
    clearDraft()
    navigate(landingAfterOnboarding(user!), { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      {/* 📥 ملخّص بيانات التشخيص — يظهر عند وجود بيانات مسبقة */}
      {hasDiagnosticData && (specialtyLabel || managerTypeLabel || teamSizeLabel) && (
        <Card className="mb-4 overflow-hidden border-2 border-sky-300 bg-gradient-to-l from-sky-50 to-transparent shadow-sm">
          <div className="h-1 bg-gradient-to-l from-sky-500 via-sky-400 to-transparent" />
          <CardContent className="p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-lg">📥</span>
              <span className="text-xs font-bold text-sky-900">
                استخدمنا بياناتك من التشخيص السابق لتخصيص الأسئلة
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {managerTypeLabel && (
                <span className="rounded-full border border-sky-400 bg-white px-2 py-0.5 font-medium text-sky-900">
                  👤 {managerTypeLabel}
                </span>
              )}
              {specialtyLabel && (
                <span className="rounded-full border border-emerald-400 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900">
                  🎯 التخصّص: {specialtyLabel}
                </span>
              )}
              {teamSizeLabel && (
                <span className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
                  👥 الفريق: {teamSizeLabel}
                </span>
              )}
              {experienceLabel && (
                <span className="rounded-full border border-violet-400 bg-violet-50 px-2 py-0.5 font-medium text-violet-900">
                  🎓 خبرة: {experienceLabel}
                </span>
              )}
              {toolingLabel && (
                <span className="rounded-full border border-slate-400 bg-slate-50 px-2 py-0.5 font-medium text-slate-800">
                  🛠️ الأدوات: {toolingLabel}
                </span>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-sky-800/80">
              💡 الأسئلة أدناه <b>مبنيّة</b> على تخصّصك ونوعك — لا تكرار للأسئلة التي أجبتها مسبقاً.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          <CardTitle>
            {currentSlide === 'identity' && 'أرقام أوّل عميل التشغيليّة (OPEX)'}
            {currentSlide === 'pains'    && (
              specialtyLabel
                ? `ما التحديات الأكبر في إدارة ${specialtyLabel}؟`
                : 'ما التحديات الأكبر حالياً؟'
            )}
            {currentSlide === 'goals'    && (
              specialtyLabel
                ? `ما الأهداف الأولى لإدارة ${specialtyLabel}؟`
                : 'ما الأهداف الأولى بالنسبة لك؟'
            )}
            {currentSlide === 'path'     && '🎯 اختر مسارك الاستراتيجي'}
          </CardTitle>
          <CardDescription>
            {currentSlide === 'identity' && (
              user?.managerType === 'INDEPENDENT_PRO'
                ? 'بياناتك تُستخدم في KPIs / تحليل الفجوة / أنسوف / RACI بلا سؤالك مرّة أخرى — لكل عميل جديد.'
                : 'تُستخدم في KPIs / تحليل الفجوة / أنسوف / RACI بلا سؤالك مرّة أخرى.'
            )}
            {currentSlide === 'pains'    && (
              user?.managerType === 'INDEPENDENT_PRO'
                ? 'اختيار متعدّد — يُحدّد أولويّة الأدوات لكل عميل تديره (مصفوفة الأولويّة / أيزنهاور).'
                : specialtyLabel
                  ? `اختيار متعدّد — التحدّيات الشائعة في إدارة ${specialtyLabel} (تُحدّد ترتيب أدواتك).`
                  : 'اختيار متعدّد — يُحدّد ترتيب أدواتك (مصفوفة الأولوية / أيزنهاور).'
            )}
            {currentSlide === 'goals'    && (
              user?.managerType === 'INDEPENDENT_PRO'
                ? 'اختيار متعدّد — الأهداف تنطبق على كل العملاء (KPIs / مبادرات).'
                : specialtyLabel
                  ? `اختيار متعدّد — الأهداف الشائعة في إدارة ${specialtyLabel} (تُشغّل الأدوات المرتبطة).`
                  : 'اختيار متعدّد — يُشغّل الأدوات المرتبطة بأهدافك تلقائياً.'
            )}
            {currentSlide === 'path'     && 'اختر عمق الرحلة الاستراتيجية — يمكن تغييره لاحقاً من /settings/path.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-6">
          {currentSlide === 'identity' && (
            <div className="grid gap-4">
              <div className="rounded-lg border bg-primary/5 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <div className="text-sm font-semibold">OPEX — أرقام تشغيلية سنوية</div>
                  {teamCountFromDx && (
                    <span className="rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
                      📥 عدد الفريق مقدَّر من تشخيصك — عدّله إن أردت
                    </span>
                  )}
                </div>
                <div className="mb-3 text-[10px] text-muted-foreground">
                  هذه أرقام تشغيليّة مالية (ميزانية/مستهدف) — <b>ليست تكرار</b> لحقل «حجم المنشأة» أعلاه.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor="team" className="text-xs">عدد الفريق (رقم دقيق)</Label>
                    <Input
                      id="team" type="number" min={0}
                      value={state.opex.team ?? ''}
                      onChange={(e) => setOpex('team', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="budget" className="text-xs">الميزانية السنوية (SAR)</Label>
                    <Input
                      id="budget" type="number" min={0}
                      value={state.opex.budget ?? ''}
                      onChange={(e) => setOpex('budget', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="target" className="text-xs">المستهدف السنوي (SAR)</Label>
                    <Input
                      id="target" type="number" min={0}
                      value={state.opex.target ?? ''}
                      onChange={(e) => setOpex('target', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="avgSalary" className="text-xs">متوسط الراتب الشهري (SAR)</Label>
                    <Input
                      id="avgSalary" type="number" min={0}
                      value={state.opex.avgSalary ?? ''}
                      onChange={(e) => setOpex('avgSalary', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentSlide === 'pains' && (
            <>
              {topPainsForSpecialty.length > 0 && (
                <div className="mb-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-[11px] text-muted-foreground">
                  ⭐ <b className="text-foreground">الأشيع لدى إدارة {specialtyLabel}:</b> أوّل ٣ عناصر أدناه (اخترنا لك ٢ افتراضياً — عدّل بحرّية).
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {[...ONBOARDING_PAINS].sort((a, b) => {
                  const ai = topPainsForSpecialty.indexOf(a.code)
                  const bi = topPainsForSpecialty.indexOf(b.code)
                  const av = ai === -1 ? 99 : ai
                  const bv = bi === -1 ? 99 : bi
                  return av - bv
                }).map((p) => {
                  const selected = state.pains.includes(p.code)
                  const isTop = topPainsForSpecialty.includes(p.code)
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => togglePain(p.code)}
                      className={`relative flex items-start gap-3 rounded-lg border p-3 text-right transition ${
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : isTop
                            ? 'border-primary/40 bg-primary/[0.03] hover:bg-accent'
                            : 'bg-card hover:bg-accent'
                      }`}
                    >
                      {isTop && !selected && (
                        <span className="absolute -top-2 right-2 rounded-full border border-primary/40 bg-white px-1.5 py-0.5 text-[9px] font-bold text-primary shadow-sm">
                          ⭐ شائع
                        </span>
                      )}
                      <span className="text-2xl" aria-hidden>{p.icon}</span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{p.labelAr}</span>
                        {p.desc && <span className="mt-0.5 block text-xs text-muted-foreground">{p.desc}</span>}
                      </span>
                      {selected && <span className="text-primary" aria-hidden>✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {currentSlide === 'goals' && (
            <>
              {topGoalsForSpecialty.length > 0 && (
                <div className="mb-2 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/60 p-2 text-[11px] text-muted-foreground">
                  ⭐ <b className="text-foreground">الأهمّ لدى إدارة {specialtyLabel}:</b> أوّل ٣ عناصر أدناه (اخترنا لك ٢ افتراضياً — عدّل بحرّية).
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {[...ONBOARDING_GOALS].sort((a, b) => {
                  const ai = topGoalsForSpecialty.indexOf(a.code)
                  const bi = topGoalsForSpecialty.indexOf(b.code)
                  const av = ai === -1 ? 99 : ai
                  const bv = bi === -1 ? 99 : bi
                  return av - bv
                }).map((g) => {
                  const selected = state.goals.includes(g.code)
                  const isTop = topGoalsForSpecialty.includes(g.code)
                  return (
                    <button
                      key={g.code}
                      type="button"
                      onClick={() => toggleGoal(g.code)}
                      className={`relative flex items-start gap-3 rounded-lg border p-3 text-right transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : isTop
                            ? 'border-emerald-400/50 bg-emerald-50/40 hover:bg-accent'
                            : 'bg-card hover:bg-accent'
                      }`}
                    >
                      {isTop && !selected && (
                        <span className="absolute -top-2 right-2 rounded-full border border-emerald-400 bg-white px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 shadow-sm">
                          ⭐ أهمّ
                        </span>
                      )}
                      <span className="text-2xl" aria-hidden>{g.icon}</span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{g.labelAr}</span>
                        {g.desc && <span className="mt-0.5 block text-xs text-muted-foreground">{g.desc}</span>}
                      </span>
                      {selected && <span className="text-emerald-600" aria-hidden>✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {currentSlide === 'path' && (
            <div className="grid gap-3 lg:grid-cols-3">
              {PATH_OPTIONS.map((opt) => {
                const selected = state.strategyPath === opt.code
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setState((p) => ({ ...p, strategyPath: opt.code }))}
                    className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-right transition ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/40'
                        : opt.colorClass
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl" aria-hidden>{opt.icon}</span>
                      <span className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium">{opt.timeAr}</span>
                    </div>
                    <div className="text-lg font-bold">{opt.labelAr}</div>
                    <div className="text-xs leading-relaxed text-muted-foreground">
                      <div><strong className="text-foreground">التركيز:</strong> {opt.focusAr}</div>
                      <div className="mt-1">{opt.stagesAr}</div>
                      <div className="mt-1 text-muted-foreground/80">{opt.toolsAr}</div>
                    </div>
                    {selected && <div className="mt-1 text-xs font-medium text-primary">✓ مختار</div>}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button variant="ghost" onClick={skip}>
            تخطّي الجميع
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>السابق</Button>
            )}
            {!isLast && (
              <Button onClick={() => setStep((s) => s + 1)}>التالي ←</Button>
            )}
            {isLast && (
              <Button onClick={submit} disabled={saving}>
                {saving ? 'جاري الحفظ…' : 'حفظ والمتابعة'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
