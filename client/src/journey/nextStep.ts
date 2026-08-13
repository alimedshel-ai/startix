// ─── محرّك «الخطوة التالية» — منطق قبل الغلاف (C1) ──────────────────
// نقيّ وقابل للاختبار: يأخذ **حالة** (اكتمال المراحل + المسار + التخصّص +
// إشارات بيانات) ويُرجع الخطوة التالية بنوعها الصريح وسببها. لا قائمة ثابتة
// — يقرأ ما اكتمل وما البوّابات المفتوحة (canOpenStage/stagesForPath).
//
// يعالج النقاط الثلاث:
//   ١) حالة-مدفوع: يمشي على مراحل المسار بالترتيب ويقف عند أوّل ناقصة.
//   ٢) حالات صريحة: action | locked | done | no-client (لا «تالٍ» غامض).
//   ٣) «لماذا»: سبب واعٍ بالبيانات لكل خطوة (لا طاعة عمياء).
//
// بوّابة مستوى-الأداة: التوليف (SWOT) يحتاج مصدر تحليل — إن لم يجهز، نوجّه
// للمصدر أوّلاً (لا للأداة التي ستُخفق) — فلا طريق مسدود بثوب جديد.

import { stagesForPath, type StageId } from '@/lib/journeyStages'
import { auditRouteFor } from '@/journey'
import type { SaudizationStatus } from '@/lib/saudization'
import type { SpecialtyDeptType, StrategyPath } from '@/types/user'

export type NextKind = 'action' | 'locked' | 'done' | 'no-client'

export interface NextStepResult {
  kind: NextKind
  stageId?: StageId
  icon: string
  /** ماذا أفعل (عنوان الزرّ). */
  label: string
  /** الوجهة — بلا ?client (يُضيفه الغلاف). undefined لغير action. */
  toolPath?: string
  /** لماذا هذه الخطوة الآن (واعٍ بالبيانات). */
  reason: string
  /** للـ locked: كيف تُفتَح. */
  unlockHint?: string
}

/** إشارات بيانات اختياريّة — تُثري «لماذا» وتضبط بوّابات الأدوات، بلا تغيير المنطق. */
export interface NextStepSignals {
  healthPct?: number | null
  /** عدد أقسام النضج الضعيفة (تخصّصات النضج) — لسبب واعٍ بالبيانات. */
  maturityWeakCount?: number
  /** هل مصدر تحليل **داخليّ** جاهز (7S/عميق/نضج/تدقيق)؟ يملأ القوّة/الضعف. */
  swotSourcesReady?: boolean
  /** هل مصدر تحليل **خارجيّ** جاهز (PESTEL/بورتر/مقارنة)؟ يملأ الفرص/التهديدات. */
  externalSourceReady?: boolean
  /** هل التخصّص يستخدم تشخيص نضج/موزون بدل أدوات التحليل التقليديّة؟ */
  usesDiagnostic?: boolean
  /** الحالة العامّة لوحدة التوطين — يرفع فجوة التوطين كأولوية مبادرة امتثال. */
  saudizationStatus?: SaudizationStatus
  /** إجماليّ فجوة التوطين بعدد الموظفين — لسبب واعٍ بالبيانات. */
  saudizationGap?: number
  /** هل عُمِلت TOWS؟ لتوصية TOWS **الناعمة** بعد SWOT (قرار المالك: تُقترَح لا تُلزَم). */
  hasTows?: boolean
}

export interface NextStepState {
  isPro: boolean
  activeCompanyId: string | null
  completions: Record<StageId, boolean>
  path: StrategyPath
  specialty: SpecialtyDeptType | null
  signals?: NextStepSignals
}

const STAGE_ICON: Record<StageId, string> = {
  environment: '🌐', synthesis: '🧭', directions: '🎯',
  indicators: '📊', initiatives: '💡', execution: '🚀',
}

// ─── سبب واعٍ بالبيانات لكل مرحلة ────────────────────────────────
function reasonFor(stage: StageId, s: NextStepState): string {
  const sig = s.signals ?? {}
  switch (stage) {
    case 'environment':
      return sig.usesDiagnostic
        ? 'ابدأ بتقييم نضج إدارتك — يكشف أقوى وأضعف جوانبها بالأرقام.'
        : sig.healthPct != null
          ? `صحّة إدارتك ${Math.round(sig.healthPct)}٪ — ابدأ بتشخيص بيئتها لمعرفة أين تقف.`
          : 'ابدأ بتشخيص البيئة الداخليّة والخارجيّة لإدارتك.'
    case 'synthesis':
      return 'لخّص نتائج تحليلك في قوّة/ضعف/فرص/تهديدات (SWOT) ثم حوّلها لاستراتيجيّات.'
    case 'directions':
      return 'من التوليف، حدّد اتّجاهك الاستراتيجي وفاضِل بين الخيارات.'
    case 'indicators':
      return 'ترجم الاستراتيجية إلى أهداف ومؤشّرات قابلة للقياس.'
    case 'initiatives': {
      // فجوة توطين غير ممتثلة = خطر امتثال — تُرفَع كأولوية مبادرة (تكامل ④).
      if (sig.saudizationStatus === 'non_compliant' && sig.saudizationGap)
        return `فجوة توطين غير ممتثلة (${sig.saudizationGap} موظّف) — أدرِجها كأولوية امتثال في مبادراتك${sig.maturityWeakCount ? `، مع ${sig.maturityWeakCount} جانباً ضعيفاً` : ''}.`
      return sig.maturityWeakCount && sig.maturityWeakCount > 0
        ? `تشخيصك كشف ${sig.maturityWeakCount} جانباً ضعيفاً — حوّلها إلى مبادرات تحسين مرتّبة.`
        : 'حوّل قرارك الاستراتيجي إلى مبادرات مرتّبة بالأولويّة.'
    }
    case 'execution':
      return 'حوّل المبادرات إلى مهام بتواريخ ومسؤولين، وتابِع التنفيذ.'
  }
}

// ─── وجهة أداة المرحلة ───────────────────────────────────────────
function toolPathFor(stage: StageId, s: NextStepState): string {
  if (stage === 'environment') {
    // تخصّصات النضج تبدأ بالتشخيص؛ غيرها بتدقيق الإدارة (نقطة دخول ①).
    if (s.signals?.usesDiagnostic) return '/manager/deep-analysis'
    return auditRouteFor(s.specialty) ?? '/internal-environment'
  }
  const map: Record<Exclude<StageId, 'environment'>, string> = {
    synthesis: '/swot', directions: '/directions',
    indicators: '/measure', initiatives: '/priority', execution: '/execute',
  }
  return map[stage]
}

function stageLabel(stage: StageId, s: NextStepState): string {
  switch (stage) {
    case 'environment': return s.signals?.usesDiagnostic ? 'ابدأ تقييم النضج' : 'ابدأ التشخيص'
    case 'synthesis':   return 'أكمل التوليف (SWOT ← TOWS)'
    case 'directions':  return 'اتّخذ القرار الاستراتيجي'
    case 'indicators':  return 'حدّد الأهداف والمؤشّرات'
    case 'initiatives': return 'أنشئ مبادرات التحسين'
    case 'execution':   return 'نفّذ وتابِع'
  }
}

// ─── المحرّك ─────────────────────────────────────────────────────
export function getNextStep(s: NextStepState): NextStepResult {
  // (لا-عميل) — حالة صريحة.
  if (s.isPro && !s.activeCompanyId) {
    return { kind: 'no-client', icon: '👥', label: 'اختر عميلاً للبدء',
      reason: 'المسار الموجّه يعمل على عميل محدّد — اختر/أضف عميلاً.' }
  }

  const stages = stagesForPath(s.path)          // مراحل هذا المسار بالترتيب
  const firstIncomplete = stages.find((id) => !s.completions[id])

  // (done) — كل مراحل المسار مكتملة.
  if (!firstIncomplete) {
    return { kind: 'done', stageId: 'execution', icon: '🏁',
      label: 'راجِع التنفيذ والمتابعة', toolPath: '/execute',
      reason: 'أكملت كل مراحل مسارك — تابِع التنفيذ وراقِب المؤشّرات دوريّاً.' }
  }

  // ملاحظة: البوّابة على مستوى المرحلة مضمونة بالمشي الخطّي — أوّل ناقصة
  // كل ما قبلها **ضمن المسار** مكتمل، فهي دائماً قابلة للفتح. لذا لا نُرجِع
  // «مقفلة» كخطوة تالية (النوع 'locked' مخصّص لعرض مراحل *لاحقة* في الشريط).
  // البوّابة الحقيقيّة الوحيدة هنا على مستوى **الأداة** (مصادر التوليف):

  // التوليف (SWOT) يُبنى من شقّين: تحليل **داخليّ** يملأ القوّة/الضعف، ومسح
  // **خارجيّ** يملأ الفرص/التهديدات. لا يكفي أحدهما — تشخيص النضج/التدقيق
  // داخليّ بحت، فالقفز منه مباشرةً لـ SWOT يُخرِج نصفه فارغاً. نمنع هذا
  // الطريق المسدود المُقنّع بالتحقّق من الشقّين، ونوجّه للناقص لا لـ SWOT.
  if (firstIncomplete === 'synthesis') {
    // أ) لا مصدر داخليّ → قوّة/ضعف فارغة.
    if (s.signals?.swotSourcesReady === false) {
      return { kind: 'action', stageId: 'environment', icon: '🌐',
        label: s.signals?.usesDiagnostic ? 'أكمل تقييم النضج (مصدر داخليّ)' : 'أكمل مصدر تحليل داخليّ (7S/عميق)',
        toolPath: s.signals?.usesDiagnostic || s.isPro ? '/manager/deep-analysis' : '/internal-environment',
        reason: 'التوليف يبدأ من تحليل داخليّ يملأ القوّة والضعف — أكمِل مصدراً واحداً أوّلاً ثم ارجع.' }
    }
    // ب) مصدر داخليّ جاهز لكن لا مسح خارجيّ → فرص/تهديدات فارغة.
    if (s.signals?.externalSourceReady === false) {
      return { kind: 'action', stageId: 'environment', icon: '🌍',
        label: 'أكمل مسحاً خارجيّاً (PESTEL)',
        toolPath: s.isPro ? '/manager/dept-pestel' : '/pestel',
        reason: 'تحليلك الحاليّ داخليّ (قوّة/ضعف). SWOT يحتاج فرصاً وتهديدات من مسح خارجيّ — أكمِل PESTEL (أو بورتر) أوّلاً.' }
    }
  }

  // توصية TOWS الناعمة (قرار المالك 2026-08-13): بعد اكتمال SWOT وقبل مغادرة
  // التوليف مباشرةً، إن لم تُعمل TOWS نقترحها — **دون بوّابة صلبة**. تظهر فقط عند
  // حدّ ②→(التالي) كي لا تعلق: فور إنجاز المرحلة التالية (أو TOWS) تختفي التوصية.
  const afterSynthesis = stages[stages.indexOf('synthesis') + 1]
  if (
    s.completions.synthesis && s.signals?.hasTows === false &&
    firstIncomplete === afterSynthesis && afterSynthesis != null
  ) {
    return {
      kind: 'action', stageId: 'synthesis', icon: '🔄',
      label: 'حوّل SWOT إلى استراتيجيات (TOWS) — مقترحة',
      toolPath: '/tows',
      reason: 'أكملت SWOT — يُنصَح بتحويلها إلى استراتيجيات TOWS قبل الانتقال. اختياريّة: يمكنك تخطّيها للخطوة التالية.',
    }
  }

  // (action) — الخطوة الطبيعيّة التالية.
  return {
    kind: 'action',
    stageId: firstIncomplete,
    icon: STAGE_ICON[firstIncomplete],
    label: stageLabel(firstIncomplete, s),
    toolPath: toolPathFor(firstIncomplete, s),
    reason: reasonFor(firstIncomplete, s),
  }
}
