import { describe, expect, it } from 'vitest'

import {
  classifyCategory,
  classifySaudization,
  computeSaudizationCost,
  saudizationAchievementPct,
  saudizationActualRatio,
  type CategoryInput,
} from './saudization'
import { isStale, SAUDIZATION_CATALOG, type SaudizationRule } from './saudizationCatalog'

const ruleOf = (id: string): SaudizationRule =>
  SAUDIZATION_CATALOG.find((r) => r.id === id)!

describe('classifyCategory — المثال المرجعيّ في المخطّط', () => {
  // مبيعات (٦٠٪، ينطبق ٣+): ٦ سعوديّ + ٤ غير سعوديّ، منهم ٤ محتسَبون فقط
  // (اثنان دون الحدّ الأدنى) → الإجماليّ ١٠، النسبة الفعليّة ٤٠٪ لا ٦٠٪.
  const r = classifyCategory(
    { ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 4 },
    ruleOf('sales'),
  )
  it('النسبة الفعليّة = ٤٠٪ (المحتسَب ÷ الإجماليّ)', () => {
    expect(r.total).toBe(10)
    expect(r.actualRatio).toBe(40)
  })
  it('المطلوب ٦ محتسبين (⌈٠٫٦×١٠⌉) → فجوة ٢', () => {
    expect(r.requiredCounted).toBe(6)
    expect(r.gap).toBe(2)
  })
  it('الحالة غير ممتثل (٤٠٪ < ٦٠×٠٫٨=٤٨ العتبة النسبيّة)', () => {
    expect(r.status).toBe('non_compliant')
  })
})

describe('حالات الامتثال والقُرب', () => {
  it('بالغ الهدف تماماً → ممتثل، فجوة ٠', () => {
    const r = classifyCategory({ ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 6 }, ruleOf('sales'))
    expect(r.status).toBe('compliant')
    expect(r.gap).toBe(0)
  })
  it('≥ ٨٠٪ نسبيّ من الهدف → قريب (أصفر)', () => {
    // ٥ محتسب / ١٠ = ٥٠٪، الهدف ٦٠٪ → ٥٠ ≥ ٦٠×٠٫٨=٤٨ → قريب
    const r = classifyCategory({ ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 5 }, ruleOf('sales'))
    expect(r.actualRatio).toBe(50)
    expect(r.status).toBe('near')
    expect(r.gap).toBe(1)
  })
})

describe('العتبة النسبيّة تتكيّف مع الفئات الحرجة (٨٠٪ نسبيّ لا هامش ثابت)', () => {
  // التغذية العلاجية: هدف ٨٠٪، بلا عتبة عدد. العتبة النسبيّة = ٦٤٪.
  it('٦٥٪ لفئة هدفها ٨٠٪ → قريب (نسبيّ ٦٥≥٦٤)، بينما هامش ١٠ الثابت كان يرسّبها', () => {
    // ١٣ محتسب / ٢٠ = ٦٥٪ · المطلوب ⌈٠٫٨×٢٠⌉=١٦ · فجوة ٣
    const r = classifyCategory(
      { ruleId: 'clinical_nutrition', saudiCount: 13, nonSaudiCount: 7, countedCount: 13 },
      ruleOf('clinical_nutrition'),
    )
    expect(r.actualRatio).toBe(65)
    expect(r.requiredCounted).toBe(16)
    expect(r.status).toBe('near') // هامش ١٠ ثابت: ٦٥ < ٧٠ → كان سيرسّبها
  })
  it('٦٠٪ لفئة هدفها ٨٠٪ → غير ممتثل (٦٠ < ٦٤)', () => {
    const r = classifyCategory(
      { ruleId: 'clinical_nutrition', saudiCount: 12, nonSaudiCount: 8, countedCount: 12 },
      ruleOf('clinical_nutrition'),
    )
    expect(r.actualRatio).toBe(60)
    expect(r.status).toBe('non_compliant')
  })
})

describe('محرّك التكلفة — الاختبار المرجعيّ (أرقام المخطّط)', () => {
  // مبيعات (حدّ ٤٠٠٠): ٨ سعوديّ · ٨ غير سعوديّ · ٥ محتسَب · متوسّط راتب غير المحتسبين ٢٨٠٠.
  // إجماليّ ١٦ · المطلوب ⌈٠٫٦×١٦⌉=١٠ · فجوة ٥ · غير محتسبين ٣.
  const cost = computeSaudizationCost(
    [{ ruleId: 'sales', saudiCount: 8, nonSaudiCount: 8, countedCount: 5 }],
    2800,
  )
  it('① رفع الرواتب = (٤٠٠٠−٢٨٠٠)×٣×١٢ = ٤٣٬٢٠٠', () => {
    expect(cost.raiseSalaries).toBe(43_200)
  })
  it('② تغيير المهن = ٨×٢٥٠٠ = ٢٠٬٠٠٠ (لمرّة واحدة)', () => {
    expect(cost.changeProfessions).toBe(20_000)
  })
  it('③ التوظيف = ٥×٤٥٠٠×١٢ = ٢٧٠٬٠٠٠', () => {
    expect(cost.hire).toBe(270_000)
  })
  it('الأوفر = ② تغيير المهن (٢٠٬٠٠٠)', () => {
    expect(cost.bestSolution).toBe('changeProfessions')
    expect(cost.bestCost).toBe(20_000)
    expect(cost.restrictedSequence).toBe(false)
  })
})

describe('حوكمة الكتالوج — مصدر + تاريخ تحقّق + تقادم', () => {
  it('كل قاعدة تحمل مصدراً وتاريخ تحقّق ISO', () => {
    for (const r of SAUDIZATION_CATALOG) {
      expect(r.source.length).toBeGreaterThan(0)
      expect(r.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
  it('صفٌّ تجاوز ٩٠ يوماً منذ التحقّق → متقادم؛ ضمنها → لا', () => {
    const r = SAUDIZATION_CATALOG[0]
    const base = Date.parse(r.verifiedOn)
    expect(isStale(r, new Date(base + 100 * 24 * 3600 * 1000))).toBe(true)
    expect(isStale(r, new Date(base + 10 * 24 * 3600 * 1000))).toBe(false)
  })
})

describe('محرّك التكلفة — المقصورة ١٠٠٪ ترفع علم التسلسل', () => {
  it('فجوة في admin_support → restrictedSequence=true', () => {
    const cost = computeSaudizationCost(
      [{ ruleId: 'admin_support', saudiCount: 2, nonSaudiCount: 1, countedCount: 2 }],
      3000,
    )
    expect(cost.restrictedSequence).toBe(true)
  })
})

describe('عتبة الانطباق', () => {
  it('إجماليّ دون عتبة القرار (٣) → لا ينطبق، بلا فجوة', () => {
    const r = classifyCategory({ ruleId: 'sales', saudiCount: 1, nonSaudiCount: 1, countedCount: 0 }, ruleOf('sales'))
    expect(r.status).toBe('not_applicable')
    expect(r.gap).toBe(0)
  })
})

describe('المقصورة ١٠٠٪ — التسلسل الإلزاميّ', () => {
  const rule = ruleOf('admin_support')
  it('وجود غير سعوديّ → فجوة + تسلسل إلزاميّ مرفوع', () => {
    const r = classifyCategory({ ruleId: 'admin_support', saudiCount: 2, nonSaudiCount: 1, countedCount: 2 }, rule)
    expect(r.requiredRatio).toBe(100)
    expect(r.gap).toBe(1)
    expect(r.status).toBe('non_compliant')
    expect(r.sequenceRequired).toBe(true)
  })
  it('لا عتبة عدد — ينطبق حتى على عامل واحد', () => {
    const r = classifyCategory({ ruleId: 'admin_support', saudiCount: 0, nonSaudiCount: 1, countedCount: 0 }, rule)
    expect(r.status).toBe('non_compliant')
    expect(r.sequenceRequired).toBe(true)
  })
  it('كلّهم سعوديّون محتسبون → ممتثل بلا تسلسل', () => {
    const r = classifyCategory({ ruleId: 'admin_support', saudiCount: 3, nonSaudiCount: 0, countedCount: 3 }, rule)
    expect(r.status).toBe('compliant')
    expect(r.sequenceRequired).toBe(false)
  })
})

describe('حرّاس السلامة (نمط IFERROR)', () => {
  it('إجماليّ ٠ → لا ينطبق، لا NaN', () => {
    const r = classifyCategory({ ruleId: 'sales', saudiCount: 0, nonSaudiCount: 0, countedCount: 0 }, ruleOf('sales'))
    expect(r.actualRatio).toBe(0)
    expect(r.status).toBe('not_applicable')
  })
  it('محتسَب أكبر من عدد السعوديّين → يُقصَر على السعوديّين', () => {
    const r = classifyCategory({ ruleId: 'sales', saudiCount: 3, nonSaudiCount: 2, countedCount: 99 }, ruleOf('sales'))
    expect(r.actualRatio).toBe(60) // 3/5
    expect(r.status).toBe('compliant')
  })
  it('مدخلات سالبة → تُعامَل كصفر', () => {
    const r = classifyCategory({ ruleId: 'sales', saudiCount: -5, nonSaudiCount: 4, countedCount: -1 }, ruleOf('sales'))
    expect(r.total).toBe(4)
    expect(r.actualRatio).toBe(0)
  })
})

describe('classifySaudization — التجميع', () => {
  const inputs: CategoryInput[] = [
    { ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 4 },       // فجوة ٢، غير ممتثل
    { ruleId: 'admin_support', saudiCount: 2, nonSaudiCount: 1, countedCount: 2 }, // فجوة ١، غير ممتثل
    { ruleId: 'engineering', saudiCount: 1, nonSaudiCount: 1, countedCount: 1 },   // إجماليّ ٢ < ٥ → لا ينطبق
    { ruleId: 'ghost', saudiCount: 9, nonSaudiCount: 9, countedCount: 9 },         // فئة غير معرّفة → تُتجاهَل
  ]
  const s = classifySaudization(inputs)

  it('يتجاهل الفئة غير المعرّفة في الكتالوج', () => {
    expect(s.results).toHaveLength(3)
  })
  it('إجماليّ الفجوة = ٢ + ١ = ٣ (المنطبقة فقط)', () => {
    expect(s.totalGap).toBe(3)
  })
  it('عدد الفئات المنطبقة = ٢', () => {
    expect(s.applicableCount).toBe(2)
  })
  it('الحالة الإجماليّة = أسوأ منطبقة = غير ممتثل', () => {
    expect(s.overallStatus).toBe('non_compliant')
  })
})

describe('saudizationActualRatio — اقتراح KPI_STR_04 (سعوديّون÷الإجمالي)', () => {
  it('٥ سعوديّ / ٥ غير / ٥ محتسَب → ٥٠٪ (لا نسبة التحقيق ٨٣٪)', () => {
    const r = saudizationActualRatio([{ ruleId: 'sales', saudiCount: 5, nonSaudiCount: 5, countedCount: 5 }])
    expect(r).toBe(50)
  })
  it('لا فئة منطبقة → null', () => {
    const r = saudizationActualRatio([{ ruleId: 'sales', saudiCount: 1, nonSaudiCount: 1, countedCount: 1 }])
    expect(r).toBeNull()
  })
  it('محتسَب أقلّ من السعوديّين (راتب دون الحدّ) يخفض الفعليّة', () => {
    // ٦ سعوديّ (٤ محتسَب) + ٤ غير → ٤/١٠ = ٤٠٪
    const r = saudizationActualRatio([{ ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 4 }])
    expect(r).toBe(40)
  })
})

describe('saudizationAchievementPct — تغذية KPI_STR_04', () => {
  it('كلّ الفئات ممتثلة → ١٠٠٪', () => {
    const s = classifySaudization([
      { ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 6 },
    ])
    expect(saudizationAchievementPct(s)).toBe(100)
  })
  it('محتسب ٤+٢ ÷ مطلوب ٦+٣ = ٦٧٪', () => {
    // sales: مطلوب ٦ محتسب ٤ · admin_support(٣ عمّال ١٠٠٪): مطلوب ٣ محتسب ٢
    const s = classifySaudization([
      { ruleId: 'sales', saudiCount: 6, nonSaudiCount: 4, countedCount: 4 },
      { ruleId: 'admin_support', saudiCount: 2, nonSaudiCount: 1, countedCount: 2 },
    ])
    expect(saudizationAchievementPct(s)).toBe(67) // round(6/9*100)
  })
  it('لا فئة منطبقة → null (يبقى الإدخال اليدويّ)', () => {
    const s = classifySaudization([
      { ruleId: 'sales', saudiCount: 1, nonSaudiCount: 1, countedCount: 0 },
    ])
    expect(saudizationAchievementPct(s)).toBeNull()
  })
})
