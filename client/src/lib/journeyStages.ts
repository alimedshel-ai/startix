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
    descAr: 'تشخيص البيئة عبر ١١ أداة (PESTEL، Porter، سلسلة القيمة، القدرات، …).',
    icon: '🌐',
    accent: 'sky',
    toolPaths: [
      '/pestel', '/manager/dept-pestel',
      '/porter', '/benchmarking',
      '/value-chain', '/core-capabilities',
      '/org-dna', '/stakeholders',
      '/manager/dept-deep', '/manager/deep-analysis',
    ],
    starredPaths: ['/pestel', '/manager/dept-pestel', '/value-chain', '/manager/deep-analysis'],
    completionArtifacts: [
      'PESTEL', 'PORTER', 'BENCHMARK', 'STAKEHOLDERS',
      'ORG_DNA', 'VALUE_CHAIN', 'CORE_CAPABILITIES',
      'DEPT_DEEP_ANSWERS',
    ],
  },
  {
    id: 'synthesis',
    order: 2,
    locked: true,
    labelAr: '② التوليف — SWOT ← TOWS',
    descAr: 'اجمع مخرجات البيئة في ٤ محاور، ثم حوّلها إلى استراتيجيات SO/ST/WO/WT.',
    icon: '🧭',
    accent: 'rose',
    toolPaths: ['/swot', '/tows', '/manager/dept-gap', '/gap-analysis'],
    starredPaths: ['/swot', '/tows'],
    completionArtifacts: ['GAP_ANALYSIS'],
    // SWOT مخزَّن في نموذج SWOT الخاص (ليس StrategicArtifact) — R5.3 يفحصه بشكل خاص.
  },
  {
    id: 'directions',
    order: 3,
    locked: true,
    labelAr: '③ التوجّهات والخيارات',
    descAr: 'التوجّه الاستراتيجي، أنسوف، BCG، الآفاق الثلاثة، الاختيار.',
    icon: '🎯',
    accent: 'amber',
    toolPaths: [
      '/directions', '/scenarios', '/choices',
      '/ansoff', '/bcg', '/space', '/qspm', '/three-horizons',
      '/ambition-gap', '/strategic-tensions',
    ],
    starredPaths: ['/directions', '/ansoff', '/bcg', '/choices'],
    completionArtifacts: [
      'DIRECTIONS', 'CHOICES', 'ANSOFF', 'BCG',
      'SPACE', 'QSPM', 'THREE_HORIZONS',
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
    toolPaths: ['/objectives', '/okrs', '/ogsm', '/kpis', '/kpi-entries', '/annual-plan'],
    starredPaths: ['/kpis', '/objectives'],
    // Objectives/OKRs/KPIs موديلات مستقلة — R5.3 يفحصها بشكل خاص.
    completionArtifacts: ['OGSM', 'ANNUAL_PLAN'],
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
      '/ai/simulation', '/projects',
    ],
    starredPaths: ['/initiatives'],
    completionArtifacts: ['PRIORITY_MATRIX', 'RISK_REGISTER'],
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
