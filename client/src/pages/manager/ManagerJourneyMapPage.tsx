import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import { useAuthStore } from '@/store/authStore'

// ─── خريطة المدير المستقل — المسار الكامل + تدفّق البيانات ───────
// الغرض: مدير مستقل يرى مسار المنصّة كاملاً من التسجيل → التنفيذ،
// ويعرف:
//   • أين هو الآن (خطوة/مرحلة)
//   • ما هي مدخلات كل خطوة (من أين تأتي البيانات)
//   • ما هي مخرجات كل خطوة (إلى أين تذهب البيانات)
//   • ما الخطوة التالية بعد الحالية
//
// نُقسّمها إلى قسمين:
//   ١) 🏁 المسار العام لمرّة واحدة (تسجيل → مسار → عميل)
//   ٢) 🔁 مسار العميل (يتكرّر لكل عميل: تدقيق → تحليل → توجّه → قياس → تنفيذ)

type StepStatus = 'done' | 'current' | 'pending' | 'locked'

interface JourneyStep {
  n: number
  icon: string
  labelAr: string
  hintAr: string
  inputs: string[]     // من أين تأتي البيانات
  outputs: string[]    // إلى أين تذهب البيانات
  to?: string          // مسار مباشر لفتح الخطوة
  toolLabelAr?: string
  color: { border: string; bg: string; text: string; dot: string }
}

const GENERAL_COLORS = { border: 'border-sky-400', bg: 'bg-sky-50/60', text: 'text-sky-900', dot: 'bg-sky-500' }

// المسار العام (يحدث مرّة واحدة)
const GENERAL_STEPS: Omit<JourneyStep, 'n'>[] = [
  {
    icon: '📝', labelAr: 'التسجيل',
    hintAr: 'إنشاء حساب المدير المستقل + اختيار التخصّص (واحد لكل مدير).',
    inputs: ['البريد + الاسم + كلمة السرّ', 'اختيار التخصّص (واحد من ١٣ إدارة)'],
    outputs: ['حساب مفعّل', 'تخصّص المدير محفوظ (يقود كل الأدوات)'],
    to: '/join',
    toolLabelAr: 'صفحة الانضمام',
    color: GENERAL_COLORS,
  },
  {
    icon: '🎯', labelAr: 'اختيار المسار',
    hintAr: 'مسار استراتيجي واحد يقود كل الاقتراحات: سريع/متوسط/طويل.',
    inputs: ['طموحك (طول الأفق)', 'سياقك (سريع الاستجابة/تكتيكي/استراتيجي)'],
    outputs: ['strategyPath يحدّد فلترة السايدبار + مدد المشاريع + ترتيب البريستات'],
    to: '/settings/path',
    toolLabelAr: 'إعدادات المسار',
    color: { border: 'border-amber-400', bg: 'bg-amber-50/60', text: 'text-amber-900', dot: 'bg-amber-500' },
  },
  {
    icon: '👥', labelAr: 'إضافة عميل',
    hintAr: 'كل عميل = شركة مستقلّة ببياناتها الخاصّة (تعزل بيانات كل عميل عن الآخر).',
    inputs: ['اسم العميل + القطاع + الحجم'],
    outputs: ['companyId يُستخدم في `?client=` عبر كل الأدوات', 'إدارة تخصّصك تُنشأ تلقائياً داخل الشركة'],
    to: '/manager/clients',
    toolLabelAr: 'عملائي',
    color: { border: 'border-emerald-400', bg: 'bg-emerald-50/60', text: 'text-emerald-900', dot: 'bg-emerald-500' },
  },
]

// مسار العميل (يتكرّر لكل عميل)
function clientSteps(companyId: string, specialty: DeptCode): Omit<JourneyStep, 'n'>[] {
  const q = `?client=${companyId}`
  const auditRoute = `/manager/${deptSlug(specialty)}/audit${q}`
  return [
    {
      icon: '📋', labelAr: 'التدقيق الأساسي',
      hintAr: '١٢-١٥ سؤالاً على ٤ محاور — يستغرق ١٠-١٥ دقيقة. أساس كلّ شيء بعده.',
      inputs: ['إجاباتك على المحاور الأربعة'],
      outputs: ['healthPct (صحّة الإدارة ٠-١٠٠٪)', 'dangerZone (آمن/تحذير/خطر/حرج)', 'درجات ٤ محاور (تُغذّي 7S + تحليل الفجوة)'],
      to: auditRoute,
      toolLabelAr: 'ابدأ التدقيق',
      color: { border: 'border-sky-400', bg: 'bg-sky-50/60', text: 'text-sky-900', dot: 'bg-sky-500' },
    },
    {
      icon: '🔬', labelAr: 'التحليل العميق (اختياري)',
      hintAr: '~٣٠+ سؤال متخصّص مقسّم إلى ٦ أنواع (وضعي/فنّي/إداري/مالي/تحدّيات/أهداف).',
      inputs: ['البنك الأساسي + أسئلة مخصّصة تختارها', 'محتوى مركز التسويق (مدموج للتسويق)'],
      outputs: ['DEPT_DEEP_FULL — صورة تفصيليّة تُغذّي SWOT وPESTEL والتوجّه'],
      to: `/manager/deep-analysis${q}`,
      toolLabelAr: 'التحليل العميق',
      color: { border: 'border-violet-400', bg: 'bg-violet-50/60', text: 'text-violet-900', dot: 'bg-violet-500' },
    },
    {
      icon: '🌐', labelAr: 'تحليل البيئة',
      hintAr: 'PESTEL خارجي + البيئة الداخليّة 7S + سلسلة القيمة + بورتر.',
      inputs: ['مخرجات التدقيق (7S، الفجوة)', 'التحليل العميق (السياق التخصّصي)', 'نوع النشاط (للتسويق)'],
      outputs: ['PESTEL_<DEPT>', 'INTERNAL_ENV', 'VALUE_CHAIN', 'PORTER — كلّها تُغذّي SWOT'],
      to: `/manager/dept-pestel${q}`,
      toolLabelAr: 'ابدأ من PESTEL',
      color: { border: 'border-teal-400', bg: 'bg-teal-50/60', text: 'text-teal-900', dot: 'bg-teal-500' },
    },
    {
      icon: '🧭', labelAr: 'التوليف — SWOT + TOWS',
      hintAr: 'اجمع القوى والضعف والفرص والتهديدات، ثم استخرج استراتيجيات TOWS.',
      inputs: ['كل مخرجات تحليل البيئة', 'مخرجات التدقيق العميق'],
      outputs: ['SWOT (٤ محاور)', 'TOWS (SO/ST/WO/WT) — يُغذّي الاتجاهات مباشرة'],
      to: `/swot${q}`,
      toolLabelAr: 'ابدأ من SWOT',
      color: { border: 'border-amber-400', bg: 'bg-amber-50/60', text: 'text-amber-900', dot: 'bg-amber-500' },
    },
    {
      icon: '🎯', labelAr: 'التوجّه والقرار',
      hintAr: 'الاتّجاهات المُمكِنة (٣-٥) ثم القرار الاستراتيجي + BMC + Ansoff + BCG.',
      inputs: ['استراتيجيّات TOWS', 'SWOT', 'الأولويّات + مواردك (فريق/ميزانية)'],
      outputs: ['DIRECTIONS', 'CHOICES (القرار المُثبَّت)', 'BMC_<DEPT>', 'ANSOFF_<DEPT>', 'BCG', 'THREE_HORIZONS_<DEPT>'],
      to: `/choices${q}`,
      toolLabelAr: 'اتّخذ القرار',
      color: { border: 'border-purple-400', bg: 'bg-purple-50/60', text: 'text-purple-900', dot: 'bg-purple-500' },
    },
    {
      icon: '📊', labelAr: 'المؤشرات والأهداف',
      hintAr: 'حوّل التوجّه إلى KPIs + أهداف SMART + خطّة سنويّة + BSC.',
      inputs: ['القرار الاستراتيجي', 'اتّجاهاتك المُختارة', 'مسارك (QUICK/MEDIUM/LONG)'],
      outputs: ['KPIs (يُقاس بها)', 'OBJECTIVES', 'BSC_<DEPT>', 'ANNUAL_PLAN — تُغذّي المبادرات'],
      to: `/kpis${q}`,
      toolLabelAr: 'أنشئ KPIs',
      color: { border: 'border-emerald-400', bg: 'bg-emerald-50/60', text: 'text-emerald-900', dot: 'bg-emerald-500' },
    },
    {
      icon: '💡', labelAr: 'المبادرات وترتيب الأولويّات',
      hintAr: 'مبادرات مرتّبة بالأولويّة (أثر × جهد) + خريطة مخاطر + مسؤوليّات RACI.',
      inputs: ['الأهداف الاستراتيجيّة', 'KPIs', 'ميزانيّتك وحجم فريقك'],
      outputs: ['INITIATIVES', 'PRIORITY_MATRIX', 'EISENHOWER', 'RISK_REGISTER', 'RACI — تُغذّي المشاريع'],
      to: `/initiatives${q}`,
      toolLabelAr: 'أنشئ المبادرات',
      color: { border: 'border-orange-400', bg: 'bg-orange-50/60', text: 'text-orange-900', dot: 'bg-orange-500' },
    },
    {
      icon: '🚀', labelAr: 'التنفيذ والمتابعة',
      hintAr: 'حوّل المبادرات إلى مشاريع بتواريخ ومسؤولين + جانت + متابعة KPIs + تحليل مالي.',
      inputs: ['المبادرات الجاهزة', 'الجدول الزمني', 'قدرات الفريق'],
      outputs: ['PROJECTS + TASKS + Gantt', 'إدخالات KPIs الدوريّة', 'التحليل المالي + المحاكاة'],
      to: `/projects${q}`,
      toolLabelAr: 'ابدأ التنفيذ',
      color: { border: 'border-rose-400', bg: 'bg-rose-50/60', text: 'text-rose-900', dot: 'bg-rose-500' },
    },
  ]
}

function deptSlug(dept: DeptCode): string {
  const map: Record<DeptCode, string> = {
    HR: 'hr', FINANCE: 'finance', SALES: 'sales', MARKETING: 'marketing',
    OPERATIONS: 'operations', IT: 'it', CUSTOMER_SERVICE: 'cs', SUPPORT: 'cs',
    LOGISTICS: 'logistics', QUALITY: 'quality', PROJECTS: 'projects',
    COMPLIANCE: 'compliance', GOVERNANCE: 'governance',
  }
  return map[dept]
}

export function ManagerJourneyMapPage() {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const strategyPath = user?.strategyPath ?? null
  const [clients, setClients] = useState<OverviewClient[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getProOverview()
      .then((res) => {
        if (!alive) return
        setClients(res.clients)
        if (res.clients.length > 0) setSelectedClientId(res.clients[0].companyId)
      })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const selectedClient = clients.find((c) => c.companyId === selectedClientId) ?? null
  const { completions } = useJourneyCompletions(selectedClientId)

  // ─── حالة كل خطوة عامّة ─────────────────────────
  const generalStatus: StepStatus[] = useMemo(() => {
    return [
      user ? 'done' : 'pending',                             // 1) registration
      strategyPath ? 'done' : (user ? 'current' : 'locked'), // 2) path
      clients.length > 0 ? 'done' : (strategyPath ? 'current' : 'locked'),  // 3) client
    ]
  }, [user, strategyPath, clients.length])

  // ─── حالة كل خطوة داخل العميل المختار ─────────
  const clientStatus: StepStatus[] = useMemo(() => {
    if (!selectedClient) return [] as StepStatus[]
    const audit = selectedClient.hasAnyAudit
    const stages = completions
    // ترتيب: تدقيق → عميق(اختياري) → بيئة → توليف → توجّه → مؤشرات → مبادرات → تنفيذ
    const arr: StepStatus[] = []
    arr.push(audit ? 'done' : 'current')
    arr.push('pending')            // deep analysis (اختياري)
    arr.push(stages.environment ? 'done' : (audit ? 'current' : 'locked'))
    arr.push(stages.synthesis  ? 'done' : (stages.environment ? 'current' : 'locked'))
    arr.push(stages.directions ? 'done' : (stages.synthesis   ? 'current' : 'locked'))
    arr.push(stages.indicators ? 'done' : (stages.directions  ? 'current' : 'locked'))
    arr.push(stages.initiatives? 'done' : (stages.indicators  ? 'current' : 'locked'))
    arr.push(stages.execution  ? 'done' : (stages.initiatives ? 'current' : 'locked'))
    // «التالي» = أوّل step غير مكتَملة.
    return arr
  }, [selectedClient, completions])

  const clientStepsList = selectedClient && specialty
    ? clientSteps(selectedClient.companyId, specialty).map((s, i) => ({ ...s, n: i + 1 }))
    : []
  const doneCount = clientStatus.filter((s) => s === 'done').length
  const pct = clientStatus.length > 0 ? Math.round((doneCount / clientStatus.length) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="🗺️ خريطة المدير المستقل — من التسجيل إلى التنفيذ"
        description="مسار واحد كامل يشرح: أين أنت؟ من أين تأتي البيانات؟ إلى أين تذهب؟ ما التالي؟"
      />

      {/* بطاقة تعريف */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">🧭</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">لماذا هذه الخريطة؟</div>
              <p className="mt-1 text-muted-foreground">
                البيانات في المنصّة تأتي من صفحات متعدّدة (تدقيق، تحليل، PESTEL، …) — قد يخلط ذلك تتبّع <b>مصادر</b> كل تحليل.
                هذه الخريطة تُظهر كل خطوة + <b>مدخلاتها</b> + <b>مخرجاتها</b> + <b>الأداة</b> المرتبطة بها،
                بترتيب واحد يتّبعه المدير من التسجيل حتى التنفيذ الدوري.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── قسم ١: المسار العام (مرّة واحدة) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🏁 القسم الأول — المسار العام (مرّة واحدة)</CardTitle>
          <CardDescription className="text-xs">
            ٣ خطوات تحدث مرّة واحدة عند بدء استخدام المنصّة — تُحدّد تخصّصك ومسارك وعميلك الأوّل.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StepList
            steps={GENERAL_STEPS.map((s, i) => ({ ...s, n: i + 1 }))}
            statuses={generalStatus}
          />
        </CardContent>
      </Card>

      {/* ─── قسم ٢: مسار العميل (لكل عميل) ─── */}
      {loading ? (
        <p className="text-center text-xs text-muted-foreground">جاري تحميل عملائك…</p>
      ) : clients.length === 0 ? (
        <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
          <CardContent className="p-4 text-center text-xs">
            <div className="mb-1 text-2xl">👥</div>
            <div className="font-bold text-amber-900">لا عملاء بعد</div>
            <div className="mt-1 text-amber-800/80">
              أضف عميلاً من صفحة «عملائي» لتظهر خطوات مساره أدناه.
            </div>
            <Link to="/manager/clients" className="mt-2 inline-block text-primary underline-offset-4 hover:underline">
              افتح عملائي ←
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">🔁 القسم الثاني — مسار العميل (يتكرّر لكل عميل)</CardTitle>
                <CardDescription className="text-xs">
                  ٨ خطوات متسلسلة يمشيها كل عميل: <b>تدقيق → تحليل → بيئة → توليف → توجّه → مؤشرات → مبادرات → تنفيذ</b>.
                </CardDescription>
              </div>
              {selectedClient && (
                <div className="rounded-full border bg-card px-3 py-1 text-xs">
                  التقدّم: <b className="tabular-nums">{doneCount}/{clientStatus.length}</b> ({pct}٪)
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* شريط اختيار عميل */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/40 p-2 text-xs">
              <span className="text-muted-foreground">عرض المسار لعميل:</span>
              {clients.map((c) => {
                const active = selectedClientId === c.companyId
                return (
                  <button
                    key={c.companyId}
                    type="button"
                    onClick={() => setSelectedClientId(c.companyId)}
                    className={`rounded-full border-2 px-2.5 py-1 transition ${
                      active ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'bg-card hover:bg-muted'
                    }`}
                  >
                    {c.companyName}
                    {c.healthPct != null && (
                      <span className="mr-1 text-[10px] tabular-nums opacity-70">({c.healthPct}٪)</span>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedClient && <Progress value={pct} className="h-2" />}

            <StepList steps={clientStepsList} statuses={clientStatus} />

            {selectedClient && specialty && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-2 text-[10px] text-muted-foreground">
                📌 السياق: <b className="text-foreground">إدارة {DEPT_LABEL[specialty]}</b> في
                {' '}<b className="text-foreground">{selectedClient.companyName}</b>
                {strategyPath && (
                  <> · المسار: <b className="text-foreground">
                    {strategyPath === 'QUICK' ? 'سريع' : strategyPath === 'MEDIUM' ? 'متوسّط' : 'طويل'}
                  </b></>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── قسم ٣: أين تُخزَّن البيانات؟ ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">💾 القسم الثالث — أين تُخزَّن البيانات؟</CardTitle>
          <CardDescription className="text-xs">
            كل خطوة تُنتج «artifact» يُحفَظ في القاعدة تحت اسم واضح — لتفهم <b>من أين</b> جاء كل تحليل.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <StorageRow icon="👤" label="حسابك" storeName="User + strategyPath" whatAr="التخصّص + المسار + التفضيلات" />
            <StorageRow icon="🏢" label="كل عميل" storeName="Company (companyId)" whatAr="اسم/قطاع/حجم/OPEX" />
            <StorageRow icon="📋" label="التدقيق" storeName="DeptAudit" whatAr="healthPct + dangerZone + درجات ٤ محاور" />
            <StorageRow icon="🔬" label="التحليل العميق" storeName="DEPT_DEEP_FULL artifact" whatAr="إجابات ٦٠+ سؤال + أسئلة مخصّصة" />
            <StorageRow icon="🌐" label="PESTEL" storeName="PESTEL_<DEPT> artifact" whatAr="٦ محاور خارجيّة + نوع النشاط" />
            <StorageRow icon="🧭" label="SWOT + TOWS" storeName="SWOT (جدول مستقلّ)" whatAr="٤ محاور + استراتيجيّات TOWS" />
            <StorageRow icon="🎯" label="التوجّه والقرار" storeName="DIRECTIONS + CHOICES artifacts" whatAr="اتّجاهات مرتّبة + القرار المُثبَّت" />
            <StorageRow icon="📊" label="المؤشّرات" storeName="KPIs + Objectives (جداول)" whatAr="مؤشّرات دوريّة + أهداف SMART" />
            <StorageRow icon="💡" label="المبادرات" storeName="Initiatives (جدول)" whatAr="مبادرات مرتّبة بالأولويّة + الأثر" />
            <StorageRow icon="🚀" label="التنفيذ" storeName="Projects + Tasks (جدولان)" whatAr="مشاريع بتواريخ + مهام + جانت" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── قائمة خطوات موحّدة ────────────────────────────────────────
function StepList({ steps, statuses }: { steps: JourneyStep[]; statuses: StepStatus[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <StepCard key={s.n} step={s} status={statuses[i] ?? 'pending'} isLast={i === steps.length - 1} />
      ))}
    </ol>
  )
}

function StepCard({ step, status, isLast }: { step: JourneyStep; status: StepStatus; isLast: boolean }) {
  const isDone = status === 'done'
  const isCurrent = status === 'current'
  const isLocked = status === 'locked'
  return (
    <li>
      <div className={`rounded-xl border-2 p-3 transition ${
        isLocked ? 'border-slate-200 bg-slate-50/40 opacity-70' :
        isDone ? 'border-emerald-300 bg-emerald-50/40' :
        isCurrent ? `${step.color.border} ${step.color.bg} shadow-md ring-2 ring-primary/30` :
        step.color.border + ' bg-card'
      }`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex size-10 items-center justify-center rounded-full text-lg font-bold text-white ${
              isDone ? 'bg-emerald-500' : isLocked ? 'bg-slate-400' : step.color.dot
            }`}>
              {isDone ? '✓' : isLocked ? '🔒' : step.n}
            </span>
            <span className="text-2xl leading-none">{step.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-bold ${step.color.text}`}>
                {step.labelAr}
              </span>
              {isDone && (
                <span className="rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  ✓ مكتَملة
                </span>
              )}
              {isCurrent && (
                <span className="rounded-full border border-primary bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  ⭐ الخطوة الحاليّة
                </span>
              )}
              {isLocked && (
                <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                  🔒 تحتاج خطوة سابقة
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.hintAr}</p>

            {/* المدخلات والمخرجات — جوهر الخريطة */}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-dashed bg-card/60 p-2">
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  ← مدخلات (من أين تأتي البيانات)
                </div>
                <ul className="space-y-0.5 text-[10px] leading-relaxed">
                  {step.inputs.map((it, j) => (
                    <li key={j} className="flex gap-1">
                      <span className="text-muted-foreground/60">·</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-dashed bg-card/60 p-2">
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  ← مخرجات (إلى أين تذهب البيانات)
                </div>
                <ul className="space-y-0.5 text-[10px] leading-relaxed">
                  {step.outputs.map((it, j) => (
                    <li key={j} className="flex gap-1">
                      <span className="text-muted-foreground/60">·</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {step.to && (
            <Link
              to={step.to}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                isCurrent
                  ? 'bg-primary text-primary-foreground shadow-sm hover:opacity-90'
                  : isLocked
                    ? 'border bg-card text-muted-foreground'
                    : 'border bg-card hover:bg-muted'
              }`}
            >
              {step.toolLabelAr ?? 'افتح'} ←
            </Link>
          )}
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-center py-1" aria-hidden>
          <div className="h-4 w-0.5 bg-muted-foreground/20" />
        </div>
      )}
    </li>
  )
}

// ─── صف تخزين بيانات ────────────────────────────────────────
function StorageRow({ icon, label, storeName, whatAr }: { icon: string; label: string; storeName: string; whatAr: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card p-2 text-xs">
      <span className="text-lg leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{label}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          <span className="rounded-md border bg-muted/40 px-1 py-0.5 font-mono text-[9px]">{storeName}</span>
          <br />
          {whatAr}
        </div>
      </div>
    </div>
  )
}
