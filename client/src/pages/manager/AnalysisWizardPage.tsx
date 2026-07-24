import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { StageBanner } from '@/components/strategic/StageBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { useRescue } from '@/hooks/useRescue'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { analysisPlanFor, type CompanySize } from '@/lib/analysisPlan'
import { listAllArtifacts, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── معالج التحليل الشامل ─────────────────────────────────────────
// يقود مدير الإدارة عبر ٤ أدوات أساسيّة للتحليل الشامل قبل الخطّة،
// مع ٥ أدوات ثانويّة اختياريّة. كل خطوة تعرض:
//   • أيقونة + عنوان + وصف + مدّة تقديريّة
//   • حالة الاكتمال (مكتَملة / التالية / بانتظار)
//   • زر «افتح» يفتح الأداة في تبويب جديد أو ينقل مباشرة
// المصدر: قراءة artifacts للعميل النشط → تحديد الاكتمال.

interface WizardStep {
  key: string
  order: number
  icon: string
  labelAr: string
  descAr: string
  durationAr: string
  path: (params: { client: string; deptSlug: string }) => string
  // artifacts التي تدلّ على اكتمال هذه الخطوة (أيّ واحد منها يكفي).
  completionArtifacts: (dept: DeptCode | null) => ArtifactType[]
  color: { border: string; bg: string; text: string; dot: string }
}

// خريطة DeptType → slug مسار التدقيق.
const DEPT_SLUG: Record<DeptCode, string> = {
  HR: 'hr', FINANCE: 'finance', SALES: 'sales', MARKETING: 'marketing',
  OPERATIONS: 'operations', IT: 'it', CUSTOMER_SERVICE: 'cs',
  SUPPORT: 'support', LOGISTICS: 'logistics', QUALITY: 'quality',
  PROJECTS: 'projects', COMPLIANCE: 'compliance', GOVERNANCE: 'governance',
}

// ─── الخطوات الأربع الأساسيّة ─────────────────────────────────────
const PRIMARY_STEPS: WizardStep[] = [
  {
    key: 'audit',
    order: 1,
    icon: '👤',
    labelAr: 'تدقيق التخصّص',
    descAr: '٤ محاور (حوكمة/مالي/فريق/رقمنة) بمعادلة صحّة موزونة. أساس كل ما بعده.',
    durationAr: '١٠–١٥ دقيقة',
    path: ({ client, deptSlug }) => `/manager/${deptSlug}/audit?client=${client}`,
    // DEPT_AUDIT_* غير مسجّل كنوع artifact — نستخدم DEPT_DEEP_ANSWERS كإشارة ضمنيّة على الاكتمال.
    // TODO: إضافة DEPT_AUDIT_${DEPT} كنوع artifact في strategicApi للتتبّع الدقيق.
    completionArtifacts: () => ['DEPT_DEEP_ANSWERS' as ArtifactType],
    color: { border: 'border-sky-300', bg: 'bg-sky-50/60', text: 'text-sky-900', dot: 'bg-sky-500' },
  },
  {
    key: 'deep',
    order: 2,
    icon: '🔬',
    labelAr: 'التحليل العميق',
    descAr: '٦٠+ سؤالاً على ٦ محاور (موقفي/فني/إداري/مالي/تحديات/أهداف). يبني السياق الكامل.',
    durationAr: '٣٠–٤٥ دقيقة',
    path: ({ client }) => `/manager/deep-analysis?client=${client}`,
    completionArtifacts: () => ['DEPT_DEEP_FULL', 'DEPT_DEEP_ANSWERS'],
    color: { border: 'border-violet-300', bg: 'bg-violet-50/60', text: 'text-violet-900', dot: 'bg-violet-500' },
  },
  {
    key: 'pestel',
    order: 3,
    icon: '🌐',
    labelAr: 'PESTEL للإدارة',
    descAr: '٦ عوامل خارجيّة (سياسي/اقتصادي/اجتماعي/تقني/بيئي/قانوني) — كيف تُؤثّر على إدارتك.',
    durationAr: '١٥–٢٠ دقيقة',
    path: ({ client }) => `/manager/dept-pestel?client=${client}`,
    completionArtifacts: (dept) => dept ? [`PESTEL_${dept}`, 'PESTEL'] : ['PESTEL'],
    color: { border: 'border-emerald-300', bg: 'bg-emerald-50/60', text: 'text-emerald-900', dot: 'bg-emerald-500' },
  },
  {
    key: 's7',
    order: 4,
    icon: '🎯',
    labelAr: 'البيئة الداخليّة 7S',
    descAr: '٧ عناصر داخليّة (استراتيجيّة/بنية/أنظمة/مهارات/موظّفون/أسلوب/قيَم مشتركة).',
    durationAr: '٢٠–٣٠ دقيقة',
    path: ({ client }) => `/internal-environment?client=${client}`,
    completionArtifacts: (dept) => dept ? [`INTERNAL_ENV_${dept}`, 'INTERNAL_ENV'] : ['INTERNAL_ENV'],
    color: { border: 'border-amber-300', bg: 'bg-amber-50/60', text: 'text-amber-900', dot: 'bg-amber-500' },
  },
]

// ─── الخطوات الاختياريّة (توسّع أعمق) ─────────────────────────────
const SECONDARY_STEPS: WizardStep[] = [
  {
    key: 'porter',
    order: 5,
    icon: '⚔️',
    labelAr: 'قوى بورتر الخمس',
    descAr: 'قوّة الموردين + العملاء + البدائل + الدخول الجديد + المنافسة.',
    durationAr: '١٥–٢٠ دقيقة',
    path: ({ client }) => `/porter?client=${client}`,
    completionArtifacts: () => ['PORTER'],
    color: { border: 'border-rose-300', bg: 'bg-rose-50/60', text: 'text-rose-900', dot: 'bg-rose-500' },
  },
  {
    key: 'value-chain',
    order: 6,
    icon: '🔗',
    labelAr: 'سلسلة القيمة',
    descAr: 'كل نشاط في إدارتك: هل يُضيف قيمة أم كلفة؟',
    durationAr: '١٥ دقيقة',
    path: ({ client }) => `/value-chain?client=${client}`,
    completionArtifacts: () => ['VALUE_CHAIN'],
    color: { border: 'border-teal-300', bg: 'bg-teal-50/60', text: 'text-teal-900', dot: 'bg-teal-500' },
  },
  {
    key: 'benchmarking',
    order: 7,
    icon: '🔍',
    labelAr: 'المقارنة المرجعيّة',
    descAr: 'قِس نضج إدارتك ضدّ أفضل الممارسات القطاعيّة.',
    durationAr: '٢٠ دقيقة',
    path: ({ client }) => `/benchmarking?client=${client}`,
    completionArtifacts: () => ['BENCHMARK'],
    color: { border: 'border-indigo-300', bg: 'bg-indigo-50/60', text: 'text-indigo-900', dot: 'bg-indigo-500' },
  },
  {
    key: 'org-dna',
    order: 8,
    icon: '🧬',
    labelAr: 'DNA المنظّمة',
    descAr: 'كيف تُتّخذ القرارات فعلياً في إدارتك؟ (السلطة/المعلومة/المحفّزات).',
    durationAr: '١٥ دقيقة',
    path: ({ client }) => `/org-dna?client=${client}`,
    completionArtifacts: () => ['ORG_DNA'],
    color: { border: 'border-pink-300', bg: 'bg-pink-50/60', text: 'text-pink-900', dot: 'bg-pink-500' },
  },
  {
    key: 'stakeholders',
    order: 9,
    icon: '👥',
    labelAr: 'أصحاب المصلحة',
    descAr: 'مَن يتأثّر بقراراتك ومَن يُؤثّر عليها؟',
    durationAr: '١٠–١٥ دقيقة',
    path: ({ client }) => `/stakeholders?client=${client}`,
    completionArtifacts: () => ['STAKEHOLDERS'],
    color: { border: 'border-slate-300', bg: 'bg-slate-50/60', text: 'text-slate-900', dot: 'bg-slate-500' },
  },
]

// خريطة مفتاح الأداة → تعريفها (لبناء القوائم من خطّة التحليل المُكيَّفة).
const STEP_BY_KEY: Record<string, WizardStep> = Object.fromEntries(
  [...PRIMARY_STEPS, ...SECONDARY_STEPS].map((s) => [s.key, s]),
)

// يبني قائمة خطوات مُثراة بحالة الاكتمال من مفاتيح خطّة التحليل.
// ملاحظة: تدقيق التخصّص يُخزَّن في جدول القسم (auditScore) لا كـartifact —
// فنعتمد hasDeptAudit لخطوة 'audit' بدل البحث في artifacts (يُصلح ظهورها
// «غير مكتَملة» رغم إنجازها).
function enrichSteps(keys: string[], dept: DeptCode | null, artifactTypes: Set<string>, hasDeptAudit: boolean) {
  return keys
    .map((k) => STEP_BY_KEY[k])
    .filter((s): s is WizardStep => !!s)
    .map((s) => ({
      ...s,
      done: (s.key === 'audit' && hasDeptAudit) || s.completionArtifacts(dept).some((t) => artifactTypes.has(t)),
    }))
}

export function AnalysisWizardPage() {
  const user = useAuthStore((s) => s.user)
  const dept = user?.specialtyDeptType ?? null
  const deptSlug = dept ? DEPT_SLUG[dept] : 'dept-deep'
  const { company, loading } = useClientScopedCompany()
  const clientId = company?.id ?? null
  const { health } = useRescue(clientId)

  const [showSecondary, setShowSecondary] = useState(false)
  const [artifactTypes, setArtifactTypes] = useState<Set<string>>(new Set())
  const [artsLoading, setArtsLoading] = useState(false)

  useEffect(() => {
    if (!clientId) return
    setArtsLoading(true)
    listAllArtifacts(clientId)
      .then((arts) => setArtifactTypes(new Set(arts.map((a) => a.type))))
      .catch(() => setArtifactTypes(new Set()))
      .finally(() => setArtsLoading(false))
  }, [clientId])

  // ─── خطّة التحليل المُكيَّفة: حجم × قطاع × نشاط × صحّة → ترتيب/تصفية ───
  const plan = useMemo(() => analysisPlanFor({
    size: (company?.size as CompanySize) ?? 'SMALL',
    sector: company?.sector ?? null,
    serviceType: company?.profile?.serviceType ?? null,
    healthPct: health.healthPct,
    dangerZone: health.dangerZone,
  }), [company?.size, company?.sector, company?.profile?.serviceType, health.healthPct, health.dangerZone])

  const primaryEnriched = useMemo(() => enrichSteps(plan.recommended, dept, artifactTypes, health.hasAudit), [plan, dept, artifactTypes, health.hasAudit])
  const secondaryEnriched = useMemo(() => enrichSteps(plan.advanced, dept, artifactTypes, health.hasAudit), [plan, dept, artifactTypes, health.hasAudit])

  const doneCount = primaryEnriched.filter((s) => s.done).length
  const pct = primaryEnriched.length ? Math.round((doneCount / primaryEnriched.length) * 100) : 0
  // الخطوة الحاليّة = أوّل خطوة موصى بها غير مكتَملة.
  const currentIdx = primaryEnriched.findIndex((s) => !s.done)

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="معالج التحليل الشامل" />
        <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
      </div>
    )
  }

  if (!clientId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="معالج التحليل الشامل" description="اختر عميلاً أوّلاً لبدء التحليل الشامل." />
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            افتح عميلاً من <Link to="/manager/clients" className="text-primary underline">قائمة العملاء</Link> ثم عد.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="معالج التحليل الشامل"
        description={dept
          ? `تحليل إدارة ${DEPT_LABEL[dept]} بـ${primaryEnriched.length} أدوات مُرتّبة حسب حجم شركتك وقطاعها وصحّتها.`
          : `تحليل الإدارة بـ${primaryEnriched.length} أدوات مُرتّبة حسب سياق الشركة.`}
      />
      <StageBanner clientQuery={`?client=${clientId}`} />

      {/* بطاقة الملخّص + شريط التقدّم */}
      <Card className="overflow-hidden border-2 border-primary/40 bg-gradient-to-l from-primary/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 via-violet-500 to-emerald-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            🔬 التحليل الشامل قبل الخطّة
            <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium tabular-nums">
              {doneCount}/{primaryEnriched.length} مكتَمِلة ({pct}٪)
            </span>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {plan.tierIcon} مستوى {plan.tierLabel}
            </span>
            {artsLoading && <span className="text-xs text-muted-foreground">جاري القراءة…</span>}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {plan.why} رتّبنا الأدوات حسب حجم شركتك وقطاعها وصحّتها — الأثقل استراتيجيّاً مُخفاة أدناه حتى تحتاجها.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={pct} className="h-2" />
          <div className="mt-2 text-[11px] text-muted-foreground">
            الوقت التقديري المتبقّي:{' '}
            <b className="text-foreground">
              {primaryEnriched.filter((s) => !s.done).length === 0
                ? 'اكتمل — انتقل إلى ② التوليف'
                : `~${(primaryEnriched.length - doneCount) * 20} دقيقة (متوسّط)`}
            </b>
          </div>
        </CardContent>
      </Card>

      {/* الخطوات الأربع الأساسيّة */}
      <ol className="space-y-3">
        {primaryEnriched.map((s, i) => {
          const isCurrent = i === currentIdx
          const to = s.path({ client: clientId, deptSlug })
          return (
            <li key={s.key}>
              <Link
                to={to}
                className={`flex flex-wrap items-start gap-3 rounded-xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                  s.done
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : isCurrent
                      ? `${s.color.border} ${s.color.bg} shadow-md ring-2 ring-primary/30`
                      : `${s.color.border} bg-card`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex size-10 items-center justify-center rounded-full font-bold text-white ${s.color.dot}`}>
                    {s.done ? '✓' : i + 1}
                  </span>
                  <span className="text-3xl leading-none">{s.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-base font-bold ${s.color.text}`}>{s.labelAr}</span>
                    {s.done && (
                      <span className="rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        ✓ مكتَملة
                      </span>
                    )}
                    {isCurrent && !s.done && (
                      <span className="rounded-full border border-primary bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        ⭐ الخطوة الحاليّة
                      </span>
                    )}
                    <span className="rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {s.durationAr}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {s.descAr}
                  </p>
                </div>
                <div className="flex items-center">
                  <span
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      s.done
                        ? 'border bg-card text-muted-foreground'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border bg-card hover:bg-muted'
                    }`}
                  >
                    {s.done ? '↻ مراجعة' : isCurrent ? '→ ابدأ الآن' : 'افتح'}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>

      {/* الأدوات المتقدّمة — مخفيّة لهذا المستوى (تظهر عند الطلب فقط) */}
      {secondaryEnriched.length > 0 && (
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowSecondary((v) => !v)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                🧬 أدوات متقدّمة ({secondaryEnriched.length}) — مخفيّة لمستوى {plan.tierLabel}
              </CardTitle>
              <CardDescription>
                أثقل استراتيجيّاً ممّا يحتاجه حجم/قطاع شركتك الآن. أنجزها لو أردت تحليلاً أعمق — لكنها ليست ضروريّة لخطّتك الأولى.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              {showSecondary ? '▲ إخفاء' : '▼ عرض'}
            </Button>
          </div>
        </CardHeader>
        {showSecondary && (
          <CardContent>
            <ol className="grid gap-2 md:grid-cols-2">
              {secondaryEnriched.map((s) => {
                const to = s.path({ client: clientId, deptSlug })
                return (
                  <li key={s.key}>
                    <Link
                      to={to}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition hover:bg-muted ${
                        s.done ? 'border-emerald-300 bg-emerald-50/40' : ''
                      }`}
                    >
                      <span className={`inline-flex size-8 items-center justify-center rounded-full text-lg ${s.color.dot} text-white`}>
                        {s.done ? '✓' : s.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{s.labelAr}</span>
                          <span className="rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {s.durationAr}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {s.descAr}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        )}
      </Card>
      )}

      {/* بطاقة الخطوة التالية بعد الاكتمال */}
      {primaryEnriched.length > 0 && doneCount === primaryEnriched.length && (
        <Card className="border-2 border-emerald-400 bg-emerald-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              ✓ اكتمل التحليل الشامل
            </CardTitle>
            <CardDescription>
              لديك الآن السياق الكامل لبناء الخطّة. الخطوة التالية: ② التوليف (SWOT → TOWS).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to={`/swot?client=${clientId}`}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              🧭 ابدأ SWOT ←
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
