// ─── R5 — التسلسل الاستراتيجي المقفل + المرحلتان المفتوحتان ────────
// المصدر: ملف الاقتراح — القسم الثالث «التسلسل المقفل».
//
// 4 مراحل مقفلة تعمل بالترتيب (لا تُفتَح المرحلة إلا بعد سابقتها):
//   ① البيئة الداخلية (تشخيص)  — 11 أداة
//   ② SWOT ← TOWS (توليف)      — 2 أداة (SWOT ثم TOWS)
//   ③ التوجّهات والخيارات       — 7 أدوات
//   ④ المؤشرات (BSC/KPIs/…)    — 5 أدوات
// ثم مرحلتان مفتوحتان (بلا قفل):
//   ⑤ المبادرات                — 6 أدوات
//   ⑥ التنفيذ والمتابعة         — 4 أدوات
//
// الاكتمال: نُعتبر المرحلة "مكتَملة" إذا وُجد artifact واحد على الأقل
// من قائمة `completionArtifacts`. R5.3 يقرأ artifacts ويحسب.

import type { ArtifactType } from './strategicApi'

export type StageId = 'environment' | 'synthesis' | 'directions' | 'indicators' | 'initiatives' | 'execution'

export interface JourneyStage {
  id: StageId
  order: number
  locked: boolean           // false للمرحلتين المفتوحتين
  labelAr: string
  descAr: string
  icon: string
  accent: 'sky' | 'rose' | 'amber' | 'emerald' | 'violet' | 'orange'
  toolPaths: string[]       // مسارات الأدوات في هذه المرحلة
  starredPaths: string[]    // الأدوات ⭐ الأساسية (تظهر بارزة)
  completionArtifacts: ArtifactType[]  // إذا وُجد أي منها → المرحلة مكتَملة
}

// ⚠️ المسارات يجب أن تُطابق nav.ts + router بالحرف الواحد.
export const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'environment',
    order: 1,
    locked: true,
    labelAr: '① البيئة الداخلية والخارجية',
    descAr: 'تشخيص البيئة عبر ٨-١١ أداة (البيئة الداخلية 7S، سلسلة القيمة، Porter، PESTEL، …).',
    icon: '🌐',
    accent: 'sky',
    // ⚠️ الترتيب مطابق لجدول المستخدم (٣-٩ + إضافة #١ البيئة الداخلية).
    // الترقيم في التعليقات يعكس رقم الأداة في جدول ٣٤ الأصلي.
    toolPaths: [
      '/internal-environment',      // #1 — البيئة الداخلية ⭐ (7S)
      '/value-chain',               // #2 — سلسلة القيمة ⭐
      '/porter',                    // #3 — Porter الخمس
      '/pestel',                    // #4 — PESTEL ⭐ (على مستوى الشركة)
      '/manager/dept-pestel',       // #4 — PESTEL ⭐ (على مستوى الإدارة)
      '/core-capabilities',         // #5 — القدرات الجوهرية
      '/benchmarking',              // #6 — المقارنة المعيارية
      // #7 رحلة العميل — غير موجودة بعد
      '/org-dna',                   // #8 — DNA المنظمة
      '/stakeholders',              // #9 — أصحاب المصلحة
      // #10 اختبار الضغط، #11 الجاهزية الرقمية — غير موجودتين
      // مصدر بيانات "البيئة الداخلية" #1 — تظهر مع الأدوات كخيار عميق:
      '/manager/dept-deep',
      '/manager/deep-analysis',
    ],
    starredPaths: [
      '/internal-environment', '/value-chain',
      '/pestel', '/manager/dept-pestel', '/manager/deep-analysis',
    ],
    completionArtifacts: [
      'INTERNAL_ENV',
      'PESTEL', 'PORTER', 'BENCHMARK', 'STAKEHOLDERS',
      'ORG_DNA', 'VALUE_CHAIN', 'CORE_CAPABILITIES',
      'DEPT_DEEP_ANSWERS', 'DEPT_DEEP_FULL',
    ],
  },
  {
    id: 'synthesis',
    order: 2,
    locked: true,
    labelAr: '② التوليف — SWOT ← TOWS',
    descAr: 'اجمع مخرجات البيئة في ٤ محاور (SWOT)، ثم حوّلها إلى استراتيجيات (TOWS).',
    icon: '🧭',
    accent: 'rose',
    // ⚠️ Gap تحوّل إلى ③ (كما في جدول المستخدم — تحليل الفجوات #16).
    toolPaths: [
      '/swot',                      // #12 — SWOT ⭐
      '/tows',                      // #13 — TOWS ⭐
    ],
    starredPaths: ['/swot', '/tows'],
    // SWOT مخزَّن في نموذج SWOT الخاص (ليس StrategicArtifact) — يُفحص خصّيصاً.
    completionArtifacts: [],
  },
  {
    id: 'directions',
    order: 3,
    locked: true,
    labelAr: '③ التوجّهات والخيارات',
    descAr: 'التوجه، BMC، الفجوات، الآفاق، الخيارات، BCG، أنسوف.',
    icon: '🎯',
    accent: 'amber',
    // ⚠️ ترتيب مطابق لجدول المستخدم (#١٤-٢٠).
    toolPaths: [
      '/directions',                // #14 — التوجه الاستراتيجي ⭐
      '/bmc',                       // #15 — نموذج الأعمال Canvas ⭐ (نُقل من ①)
      '/gap-analysis',              // #16 — تحليل الفجوات (نُقل من ②)
      '/manager/dept-gap',          //     — نظيرة الإدارة
      '/three-horizons',            // #17 — الآفاق الثلاثة
      '/choices',                   // #18 — الخيارات الاستراتيجية ⭐
      '/bcg',                       // #19 — BCG ⭐
      '/ansoff',                    // #20 — أنسوف ⭐
      // أدوات إضافية غير موجودة في جدول ٣٤ لكنها جزء من الاختيار.
      '/scenarios', '/space', '/qspm',
      '/ambition-gap', '/strategic-tensions',
    ],
    starredPaths: ['/directions', '/bmc', '/choices', '/bcg', '/ansoff'],
    completionArtifacts: [
      'DIRECTIONS', 'BMC', 'GAP_ANALYSIS',
      'THREE_HORIZONS', 'CHOICES', 'BCG', 'ANSOFF',
      'SPACE', 'QSPM',
      'AMBITION_GAP', 'STRATEGIC_TENSIONS',
    ],
  },
  {
    id: 'indicators',
    order: 4,
    locked: true,
    labelAr: '④ الأهداف والمؤشرات',
    descAr: 'الأهداف الاستراتيجية، OKRs، KPIs، OGSM، الخريطة السببية.',
    icon: '📊',
    accent: 'emerald',
    toolPaths: ['/objectives', '/okrs', '/ogsm', '/kpis', '/kpi-entries', '/annual-plan', '/bsc'],
    starredPaths: ['/kpis', '/objectives', '/bsc'],
    // Objectives/OKRs/KPIs موديلات مستقلة — R5.3 يفحصها بشكل خاص.
    completionArtifacts: ['OGSM', 'ANNUAL_PLAN', 'BSC'],
  },
  {
    id: 'initiatives',
    order: 5,
    locked: false, // ✅ مفتوحة بعد إكمال المراحل الأربع
    labelAr: '⑤ المبادرات والمخاطر',
    descAr: 'مبادرات مرتّبة بالأولوية + مصفوفة مخاطر + محاكاة سيناريوهات.',
    icon: '💡',
    accent: 'violet',
    toolPaths: [
      '/initiatives', '/priority-matrix', '/risk-map',
      // R6 — أيزنهاور و RACI ينتميان للمرحلة ٥ (المبادرات والمسؤوليات).
      '/eisenhower', '/raci', '/projects',
      // مختبر المحاكاة يحتاج Claude API (PROFESSIONAL) — نُبقيه في نهاية
      // المرحلة كأداة اختيارية بدل عرقلة المسار بأداة قد لا تعمل بالحدّ الأدنى.
      '/ai/simulation',
    ],
    starredPaths: ['/initiatives', '/raci', '/eisenhower'],
    completionArtifacts: ['PRIORITY_MATRIX', 'RISK_REGISTER', 'EISENHOWER', 'RACI'],
  },
  {
    id: 'execution',
    order: 6,
    locked: false,
    labelAr: '⑥ التنفيذ والمتابعة',
    descAr: 'مخطط جانت، المهام، لوحة حية، تقارير ذكية.',
    icon: '🚀',
    accent: 'orange',
    toolPaths: ['/gantt-chart', '/tasks', '/ai-center'],
    starredPaths: ['/gantt-chart'],
    completionArtifacts: [],
  },
]

// ─── حسابات مساعدة ─────────────────────────────────────────────────

export interface StageCompletion {
  stageId: StageId
  complete: boolean
  // مصادر الاكتمال المُلبَّاة (للعرض).
  matched: string[]
}

/**
 * دالة نقيّة: هل يمكن فتح المرحلة `target`؟
 * القاعدة: المرحلة مفتوحة إذا (locked=false) أو إذا كل المراحل المقفلة
 * السابقة مكتَملة.
 */
export function canOpenStage(
  target: StageId,
  completions: Record<StageId, boolean>,
): boolean {
  const stage = JOURNEY_STAGES.find((s) => s.id === target)
  if (!stage) return false
  if (!stage.locked) {
    // المرحلة نفسها غير مقفلة — لكن نطلب اكتمال كل السابقة المقفلة.
    const previousLocked = JOURNEY_STAGES.filter(
      (s) => s.locked && s.order < stage.order,
    )
    return previousLocked.every((s) => completions[s.id])
  }
  // للمقفلة: order=1 مفتوحة دائماً. غيرها تعتمد على اكتمال السابقة مباشرة.
  if (stage.order === 1) return true
  const prev = JOURNEY_STAGES.find((s) => s.order === stage.order - 1)
  if (!prev) return false
  return completions[prev.id]
}

/**
 * ما التقدّم الكلّي؟ نسبة مئوية = عدد المكتَمِلة ÷ عدد المقفلة.
 */
export function overallProgressPct(completions: Record<StageId, boolean>): number {
  const locked = JOURNEY_STAGES.filter((s) => s.locked)
  const done = locked.filter((s) => completions[s.id]).length
  return locked.length ? Math.round((done / locked.length) * 100) : 0
}

// ─── سياق المستخدم — يُستخدم لفلترة المسارات ─────────────────────
// المدير المستقل (INDEPENDENT_PRO) يعمل على إدارة واحدة، فنُخفي أدوات
// الشركة الكاملة التي لها نظير على مستوى الإدارة:
//   /pestel           → /manager/dept-pestel
//   /gap-analysis     → /manager/dept-gap
// الـOWNER بالعكس — لا نُظهر له أدوات إدارية (لا يوجد له تخصّص).

const DEPT_SCOPED_REPLACEMENTS: Record<string, string> = {
  '/pestel':       '/manager/dept-pestel',
  '/gap-analysis': '/manager/dept-gap',
}

/**
 * فلترة قائمة toolPaths حسب سياق المستخدم:
 * - isDeptScoped=true (INDEPENDENT_PRO مع تخصّص): حذف نسخ الشركة، إبقاء نسخ الإدارة.
 * - isDeptScoped=false: حذف نسخ الإدارة، إبقاء نسخ الشركة.
 */
export function filterToolsForUser(paths: string[], isDeptScoped: boolean): string[] {
  const deptEquivalents = new Set(Object.values(DEPT_SCOPED_REPLACEMENTS))
  const companyOnly = new Set(Object.keys(DEPT_SCOPED_REPLACEMENTS))
  return paths.filter((p) => {
    if (isDeptScoped && companyOnly.has(p)) return false        // مدير مستقل → احذف نسخة الشركة
    if (!isDeptScoped && deptEquivalents.has(p)) return false   // مالك/داخلي → احذف نسخة الإدارة
    return true
  })
}
