import { Link } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { isStageInPath, type StageId } from '@/lib/journeyStages'
import { useAuthStore } from '@/store/authStore'

// ─── بطاقة رحلة التخطيط — ٦ خطوات موحّدة يسهل فهمها ────────────
// الغرض: يفهم المدير المستقل «كيف تعمل المنصّة» من نظرة واحدة،
// ويعرف أين هو الآن، وأين الخطوة التالية.
//
// نستخدمها في:
//   • ClientDetailPage — تعرض تقدّم عميل محدّد (companyId).
//   • ClientsPage — تعرض "كيف تعمل المنصّة" (بلا companyId → أزرار
//     تدعو لفتح عميل، بلا شارات إتمام).

interface PlanningStep {
  key: 'audit' | 'analysis' | 'synthesis' | 'direction' | 'measure' | 'execute'
  icon: string
  labelAr: string
  hintAr: string
  durationAr: string
  toolLabelAr: string
  toolPath: (companyQ: string, deptAuditPath?: string) => string
  stageId: StageId
  color: {
    border: string
    bg: string
    text: string
    dot: string
  }
}

// ─── ٦ خطوات مرتّبة بالتسلسل الحقيقي — كل خطوة تُغذّي ما بعدها ───
// المسارات تفتح صفحات معالجة (Hub / Wizard) تُرشد المدير عبر أدوات المرحلة
// بالترتيب، بدل قفزة مباشرة لأداة نهائيّة تتخطّى الخطوات المؤسِّسة.
const STEPS: PlanningStep[] = [
  {
    key: 'audit',
    icon: '📋',
    labelAr: 'الخطوة ١ — التدقيق الأوّلي',
    hintAr: 'ابدأ بالتدقيق الأساسي (٤ محاور: حوكمة/مالي/فريق/رقمنة) لأخذ صورة أوّليّة عن الإدارة.',
    durationAr: '١٠-١٥ دقيقة',
    toolLabelAr: 'ابدأ التدقيق',
    toolPath: (q, deptAudit) => `${deptAudit ?? '/manager/dept-deep'}${q}`,
    stageId: 'environment',
    color: { border: 'border-sky-300', bg: 'bg-sky-50/50', text: 'text-sky-900', dot: 'bg-sky-500' },
  },
  {
    key: 'analysis',
    icon: '🔬',
    labelAr: 'الخطوة ٢ — التحليل الشامل',
    hintAr: 'معالج ٤ أدوات بالترتيب: تدقيق التخصّص → التحليل العميق → PESTEL → البيئة الداخليّة 7S.',
    durationAr: '٦٠-٩٠ دقيقة',
    toolLabelAr: 'افتح معالج التحليل',
    toolPath: (q) => `/manager/analysis-wizard${q}`,
    stageId: 'environment',
    color: { border: 'border-violet-300', bg: 'bg-violet-50/50', text: 'text-violet-900', dot: 'bg-violet-500' },
  },
  {
    key: 'synthesis',
    icon: '🧭',
    labelAr: 'الخطوة ٣ — التوليف (SWOT ← TOWS)',
    hintAr: 'اجمع مخرجات التحليل في ٤ محاور (SWOT)، ثم حوّلها إلى استراتيجيّات (TOWS).',
    durationAr: '٢٠-٣٠ دقيقة',
    toolLabelAr: 'ابدأ SWOT',
    toolPath: (q) => `/swot${q}`,
    stageId: 'synthesis',
    color: { border: 'border-amber-300', bg: 'bg-amber-50/50', text: 'text-amber-900', dot: 'bg-amber-500' },
  },
  {
    key: 'direction',
    icon: '🎯',
    labelAr: 'الخطوة ٤ — التوجّه والقرار',
    hintAr: 'اقترح ٣-٥ اتجاهات (Directions/BMC/Ansoff)، ثم اختر الأفضل (Choices) مع مبرّرات.',
    durationAr: '٣٠-٤٥ دقيقة',
    toolLabelAr: 'ابدأ التوجّه',
    toolPath: (q) => `/directions${q}`,
    stageId: 'directions',
    color: { border: 'border-purple-300', bg: 'bg-purple-50/50', text: 'text-purple-900', dot: 'bg-purple-500' },
  },
  {
    key: 'measure',
    icon: '📊',
    labelAr: 'الخطوة ٥ — الأهداف والقياس',
    hintAr: 'حدّد أهدافاً استراتيجيّة + OKRs + KPIs + BSC + الخطة السنويّة — كلها في مركز واحد.',
    durationAr: '٤٥-٦٠ دقيقة',
    toolLabelAr: 'افتح مركز القياس',
    toolPath: (q) => `/measure${q}`,
    stageId: 'indicators',
    color: { border: 'border-emerald-300', bg: 'bg-emerald-50/50', text: 'text-emerald-900', dot: 'bg-emerald-500' },
  },
  {
    key: 'execute',
    icon: '🚀',
    labelAr: 'الخطوة ٦ — المبادرات والتنفيذ',
    hintAr: 'حوّل الاتجاه إلى مبادرات ومشاريع بتواريخ ومهام على مخطّط جانت.',
    durationAr: 'مستمرّ',
    toolLabelAr: 'ابدأ التنفيذ',
    toolPath: (q) => `/priority${q}`,
    stageId: 'initiatives',
    color: { border: 'border-rose-300', bg: 'bg-rose-50/50', text: 'text-rose-900', dot: 'bg-rose-500' },
  },
]

export function PlanningJourneyCard({
  companyId,
  deptAuditRoute,
  hideProgress,
}: {
  /** إذا وُجد → تعرض حالة إتمام لعميل محدّد. بدونه → دليل تعليمي بلا حالات. */
  companyId?: string | null
  /** مسار التدقيق التخصّصي (مثلاً /manager/hr/audit). */
  deptAuditRoute?: string
  /** إخفاء شريط التقدّم — مفيد في وضع الدليل بلا عميل. */
  hideProgress?: boolean
}) {
  const { completions, loading } = useJourneyCompletions(companyId ?? null)
  const strategyPath = useAuthStore((s) => s.user?.strategyPath ?? null)
  const q = companyId ? `?client=${companyId}` : ''

  // في وضع التقدّم (عميل محدّد) نعرض خطوات المسار فقط — فلا يعلق الشريط تحت
  // ١٠٠٪ بمراحل خارج خطة المستخدم. في وضع الدليل (بلا عميل) نُبقي الست كاملة.
  const visibleSteps = companyId
    ? STEPS.filter((s) => isStageInPath(s.stageId, strategyPath))
    : STEPS

  // تحويل حالة الاكتمال إلى «مكتمل / قيد العمل / لم يبدأ» لكل خطوة.
  const steps = visibleSteps.map((s, i) => {
    if (!companyId) return { ...s, status: 'guide' as const, order: i + 1 }
    const done = completions[s.stageId]
    // أول خطوة غير مكتَملة = «قيد العمل الآن».
    const status: 'done' | 'current' | 'pending' = done ? 'done' : 'pending'
    return { ...s, status, order: i + 1 }
  })
  // نُحدّد الخطوة الحاليّة كأوّل خطوة غير مكتَملة.
  const currentIdx = steps.findIndex((s) => s.status === 'pending')
  const stepsWithCurrent = steps.map((s, i) => ({
    ...s,
    status: companyId && i === currentIdx ? 'current' as const : s.status,
  }))

  const doneCount = stepsWithCurrent.filter((s) => s.status === 'done').length
  const pct = Math.round((doneCount / visibleSteps.length) * 100)

  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-l from-primary/10 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          🗺️ خطتك في {visibleSteps.length} خطوات
          {companyId && !loading && (
            <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium tabular-nums">
              {doneCount}/{visibleSteps.length} مكتَمِلة ({pct}٪)
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {companyId
            ? 'اضغط أيّ خطوة لفتح أداتها الأساسيّة — الترتيب مقصود، ابدأ من الأعلى.'
            : 'هذه رحلة التخطيط في المنصّة — افتح عميلاً من الأسفل لبدء تنفيذها.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {companyId && !hideProgress && (
          <Progress value={pct} className="h-2" />
        )}

        <ol className="space-y-2">
          {stepsWithCurrent.map((s) => {
            const isDone = s.status === 'done'
            const isCurrent = s.status === 'current'
            const to = s.toolPath(q, deptAuditRoute)
            return (
              <li key={s.key}>
                <Link
                  to={to}
                  className={`flex flex-wrap items-start gap-3 rounded-xl border-2 p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
                    isDone
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : isCurrent
                        ? `${s.color.border} ${s.color.bg} shadow-md ring-2 ring-primary/30`
                        : s.color.border + ' bg-card'
                  } ${!companyId ? 'opacity-90' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex size-8 items-center justify-center rounded-full font-bold text-white ${s.color.dot}`}>
                      {isDone ? '✓' : s.order}
                    </span>
                    <span className="text-2xl leading-none">{s.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-bold ${s.color.text}`}>{s.labelAr}</span>
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
                      <span className="rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {s.durationAr}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {s.hintAr}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                        isDone
                          ? 'border bg-card text-muted-foreground'
                          : isCurrent
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'border bg-card hover:bg-muted'
                      }`}
                    >
                      {isDone ? '↻ مراجعة' : isCurrent ? `→ ${s.toolLabelAr}` : s.toolLabelAr}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>

        {!companyId && (
          <div className="rounded-lg border border-dashed bg-card/40 p-3 text-xs leading-relaxed text-muted-foreground">
            💡 <b className="text-foreground">للبدء:</b> افتح أي عميل من قائمتك أدناه، وستظهر لك هذه الخطوات
            مع تقدّمك الفعلي. تدقيق واحد + SWOT + قرار = خطّة استراتيجيّة كاملة في ساعتين تقريباً.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
