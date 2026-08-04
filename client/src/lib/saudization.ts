// ─── محرّك تصنيف التوطين — دالة نقيّة قابلة للاختبار (محرك قبل شاشة) ────────
// الفلسفة: «الأرقام تُطلِع النِّسَب بدل كتابتها تخميناً». المستخدم يُدخل الأعداد
// (سعوديّ/غير سعوديّ/محتسَب لكلّ فئة) والمحرّك يحسب: النسبة الفعليّة ← الفجوة ←
// الحالة. المخرجات تبقى KPI_* (لا DRV_* يوازي مؤشّراً قائماً — تُغذّي KPI_STR_04).
// جدول العبور HRQ_* → KPI_* في docs/SAUDIZATION_GAP.md.
//
// ⚠️ خارج نطاق هذه النسخة عمداً (تحتاج تعريف المالك قبل الكود):
//   • تكلفة «الحلول الثلاثة» + KPI_BEST_SOLUTION_COST — الحلول وصيَغ تكلفتها
//     غير محدّدة في المصدر. المحرّك يكتفي بالفجوة والحالة والتسلسل الإلزاميّ.

import {
  countingFloor,
  currentRatio,
  SAUDIZATION_CATALOG,
  type SaudizationRule,
} from './saudizationCatalog'

/** مدخلات فئة واحدة — معرّفات HRQ_* (مدخلات فقط). */
export interface CategoryInput {
  ruleId: string
  saudiCount: number     // HRQ_SAUDI_COUNT — إجمالي السعوديّين في الفئة
  nonSaudiCount: number  // HRQ_NONSAUDI_COUNT — غير السعوديّين
  countedCount: number   // HRQ_COUNTED_COUNT — المحتسبون فعليّاً (راتب ≥ الحدّ الأدنى)
}

export type SaudizationStatus = 'not_applicable' | 'compliant' | 'near' | 'non_compliant'

export interface CategoryResult {
  ruleId: string
  category: string
  total: number            // إجمالي العاملين في الفئة = سعوديّ + غير سعوديّ
  requiredRatio: number    // النسبة المطلوبة السارية (٪)
  actualRatio: number      // KPI: المحتسَبون ÷ الإجمالي (٪، مقرّبة لخانتين)
  requiredCounted: number   // العدد المطلوب من المحتسبين لبلوغ النسبة
  gap: number              // KPI_SAUDIZATION_GAP للفئة = max(0, المطلوب − المحتسَب)
  status: SaudizationStatus // KPI_SAUDIZATION_STATUS: أخضر/أصفر/أحمر/لا ينطبق
  restricted: boolean
  sequenceRequired: boolean // مقصورة ١٠٠٪ + فجوة → تسلسل إلزاميّ (توظيف ثمّ تغيير مهنة)
}

// عتبة «قريب» (أصفر) **نسبيّة**: بلغ ≥ ٨٠٪ من النسبة المطلوبة. نسبيّة لا ثابتة
// كي تتكيّف مع الفئات الحرجة — هامشٌ ثابت (١٠ نقاط) يعطي «قريباً» عند ٧٠٪ لفئةٍ
// هدفها ٨٠٪، بينما ٨٠٪ نسبيّ يرفع العتبة إلى ٦٤٪ فتُصنَّف ٧٠٪ «قريباً» بحقّ.
export const NEAR_RATIO = 0.8

const clampNonNeg = (n: number): number =>
  !isFinite(n) || n < 0 ? 0 : n

const round2 = (n: number): number => Math.round(n * 100) / 100

/** يصنّف فئة واحدة مقابل قاعدتها في الكتالوج. */
export function classifyCategory(input: CategoryInput, rule: SaudizationRule): CategoryResult {
  // حرّاس IFERROR: مدخلات سالبة/غير رقميّة → ٠؛ المحتسَب لا يتجاوز عدد السعوديّين.
  const saudi = clampNonNeg(input.saudiCount)
  const nonSaudi = clampNonNeg(input.nonSaudiCount)
  const counted = Math.min(clampNonNeg(input.countedCount), saudi)
  const total = saudi + nonSaudi
  const requiredRatio = currentRatio(rule)

  const base = {
    ruleId: rule.id,
    category: rule.category,
    total,
    requiredRatio,
    restricted: !!rule.restricted,
  }

  // لا ينطبق: إجمالي دون عتبة القرار (والقاعدة ليست مقصورة بلا عتبة).
  if (total === 0 || (total < rule.applyMinWorkers && !rule.restricted)) {
    return { ...base, actualRatio: total ? round2((counted / total) * 100) : 0, requiredCounted: 0, gap: 0, status: 'not_applicable', sequenceRequired: false }
  }

  const actualRatio = round2((counted / total) * 100)
  const requiredCounted = Math.ceil((requiredRatio / 100) * total)
  const gap = Math.max(0, requiredCounted - counted)

  let status: SaudizationStatus
  if (gap === 0) status = 'compliant'
  else if (actualRatio >= requiredRatio * NEAR_RATIO) status = 'near'
  else status = 'non_compliant'

  // التسلسل الإلزاميّ للمقصورة ١٠٠٪: توظيف سعوديّ ورفع عقده أولاً، ثمّ تغيير مهنة
  // غير السعوديّ — خطوتان مترابطتان، لا حلّ واحد، وإلا نُصح بإجراء غير نظاميّ.
  const sequenceRequired = !!rule.restricted && gap > 0

  return { ...base, actualRatio, requiredCounted, gap, status, sequenceRequired }
}

export interface SaudizationSummary {
  results: CategoryResult[]
  totalGap: number                 // Σ فجوات الفئات المنطبقة → KPI إجماليّ
  overallStatus: SaudizationStatus // أسوأ حالة منطبقة → شارة السايد بار/القمرة
  applicableCount: number
}

const SEVERITY: Record<SaudizationStatus, number> = {
  not_applicable: 0, compliant: 1, near: 2, non_compliant: 3,
}

/**
 * نسبة السعودة الفعليّة / المستهدفة (٪) — تُغذّي KPI_STR_04 القائم بدل الإدخال
 * اليدويّ (لا DRV_* يوازيه — نُحوّله من رقم مطبوع إلى ناتج محسوب). التعريف:
 * إجماليّ المحتسبين ÷ إجماليّ المطلوب عبر الفئات المنطبقة، مقصوراً على ١٠٠٪.
 * يعود null إن لا فئة منطبقة (لا شيء ليُغذّى — يبقى الإدخال اليدويّ).
 */
export function saudizationAchievementPct(summary: SaudizationSummary): number | null {
  const applicable = summary.results.filter((r) => r.status !== 'not_applicable')
  const required = applicable.reduce((s, r) => s + r.requiredCounted, 0)
  if (required === 0) return null
  const counted = applicable.reduce((s, r) => s + (r.requiredCounted - r.gap), 0)
  return Math.min(100, Math.round((counted / required) * 100))
}

// ─── محرّك تكلفة الحلول الثلاثة (الصيغ المعتمدة) — KPI_BEST_SOLUTION_COST ─────
export const HIRE_MONTHLY_SALARY = 4500      // ③ راتب السعوديّ المُوظَّف (ريال/شهر)
export const PROFESSION_CHANGE_ONCE = 2500   // ② تكلفة تغيير مهنة غير سعوديّ (لمرّة واحدة)

export type SaudizationSolution = 'raiseSalaries' | 'changeProfessions' | 'hire'

export interface SolutionCosts {
  /** ① رفع رواتب غير المحتسبين للحدّ = Σ max(0, الحدّ − متوسّط الرواتب) × (سعوديّ − محتسَب) × ١٢. */
  raiseSalaries: number
  /** ② تغيير مهن غير السعوديّين = Σ غير سعوديّ × ٢٥٠٠ (لمرّة واحدة، لا تُضرب في ١٢). */
  changeProfessions: number
  /** ③ توظيف سعوديّين = إجماليّ الفجوة × ٤٥٠٠ × ١٢. */
  hire: number
  bestSolution: SaudizationSolution
  bestCost: number
  /** مقصورة ١٠٠٪ بفجوة: ③ جزءٌ من تسلسل إلزاميّ (توظيف ثمّ تغيير مهنة) لا بديلٌ مستقلّ. */
  restrictedSequence: boolean
}

/**
 * يحسب تكلفة الحلول الثلاثة السنويّة ويختار الأوفر. `avgLowSalary` = متوسّط راتب
 * غير المحتسبين (من أساس الأرقام) — يُغذّي ①. يُحسب على الفئات المنطبقة ذات الفجوة.
 */
export function computeSaudizationCost(
  inputs: CategoryInput[],
  avgLowSalary: number,
  catalog: SaudizationRule[] = SAUDIZATION_CATALOG,
): SolutionCosts {
  const byId = new Map(catalog.map((r) => [r.id, r]))
  let raiseSalaries = 0
  let changeProfessions = 0
  let totalGap = 0
  let restrictedSequence = false

  for (const inp of inputs) {
    const rule = byId.get(inp.ruleId)
    if (!rule) continue
    const res = classifyCategory(inp, rule)
    if (res.status === 'not_applicable' || res.gap === 0) continue

    const saudi = clampNonNeg(inp.saudiCount)
    const counted = Math.min(clampNonNeg(inp.countedCount), saudi)
    const nonSaudi = clampNonNeg(inp.nonSaudiCount)
    const floor = countingFloor(rule)

    // ① رفع غير المحتسبين للحدّ (فقط إن عُرف الحدّ رقماً ومتوسّطهم دونه).
    if (floor != null && isFinite(avgLowSalary)) {
      raiseSalaries += Math.max(0, floor - avgLowSalary) * (saudi - counted) * 12
    }
    // ② تغيير مهن غير السعوديّين (لمرّة واحدة).
    changeProfessions += nonSaudi * PROFESSION_CHANGE_ONCE
    // ③ توظيف — يُجمَّع كإجماليّ فجوة.
    totalGap += res.gap
    if (rule.restricted) restrictedSequence = true
  }

  const hire = totalGap * HIRE_MONTHLY_SALARY * 12
  const options: [SaudizationSolution, number][] = [
    ['raiseSalaries', raiseSalaries],
    ['changeProfessions', changeProfessions],
    ['hire', hire],
  ]
  // الأوفر = الأدنى تكلفةً بين الحلول المنطبقة (تكلفة صفر = حلٌّ غير منطبق يُستبعَد).
  const applicable = options.filter(([, v]) => v > 0)
  const best = applicable.length
    ? applicable.reduce((min, cur) => (cur[1] < min[1] ? cur : min))
    : (['hire', 0] as [SaudizationSolution, number])

  return { raiseSalaries, changeProfessions, hire, bestSolution: best[0], bestCost: best[1], restrictedSequence }
}

/** يصنّف كلّ الفئات المُدخَلة ويلخّص الإجماليّ. الفئات غير المعرّفة في الكتالوج تُتجاهَل. */
export function classifySaudization(
  inputs: CategoryInput[],
  catalog: SaudizationRule[] = SAUDIZATION_CATALOG,
): SaudizationSummary {
  const byId = new Map(catalog.map((r) => [r.id, r]))
  const results = inputs
    .map((inp) => {
      const rule = byId.get(inp.ruleId)
      return rule ? classifyCategory(inp, rule) : null
    })
    .filter((r): r is CategoryResult => r !== null)

  const applicable = results.filter((r) => r.status !== 'not_applicable')
  const totalGap = applicable.reduce((s, r) => s + r.gap, 0)
  const overallStatus = applicable.reduce<SaudizationStatus>(
    (worst, r) => (SEVERITY[r.status] > SEVERITY[worst] ? r.status : worst),
    'not_applicable',
  )

  return { results, totalGap, overallStatus, applicableCount: applicable.length }
}
