import { describe, expect, it } from 'vitest'

import { computeFinancialHealth, type FinancialKpis } from './financialHealth'

// الشركة المرجعيّة الصادقة من الإكسل (COMPUTE_FINANCIAL_HEALTH_SPEC.md §٦):
// إدارةٌ ممتازة وربحيّةٌ منتفخة بنيويّاً، لكن سيولةٌ فوريّة ٠٫١١ = طوارئ فعليّة.
const HONEST: FinancialKpis = {
  instantLiquidity: 0.11, quickRatio: 2.38, collectionRate: 0.92,
  receivables: 3_860_000, receivablesTarget: 2_000_000, debtToEquity: 0.72,
  workingCapital: 2_368_716, payrollToRevenue: 0.31, materialsToRevenue: 0.0,
  revenuePerDirectEmployee: 257_208, netMargin: 0.34, grossMargin: 0.97, roe: 0.92,
}

// شركةٌ سليمةٌ فعلاً — كلّ مؤشّر عند هدفه أو فوقه (اختبار §٦ المضادّ).
const HEALTHY: FinancialKpis = {
  instantLiquidity: 1.2, quickRatio: 1.6, collectionRate: 0.96,
  receivables: 1_800_000, receivablesTarget: 2_000_000, debtToEquity: 0.8,
  workingCapital: 500_000, payrollToRevenue: 0.28, materialsToRevenue: 0.30,
  revenuePerDirectEmployee: 220_000, netMargin: 0.22, grossMargin: 0.70, roe: 0.18,
}

describe('§٦ — الاختبار الأصدق: السيولة الفوريّة تُجبر الطوارئ', () => {
  it('الحالة الحقيقيّة تُخرج ٣٠ وفيتو INSTANT_LIQUIDITY (لا «قويّ» ولا «تميّز»)', () => {
    const r = computeFinancialHealth(HONEST)
    expect(r.healthPct).toBe(30)
    expect(r.vetoes).toContain('INSTANT_LIQUIDITY')
  })

  it('الترجيح وحدَه كان سيكذب فوق ٧٠ — الفيتو هو ما يصحّح القراءة', () => {
    // بلا الفيتو كان المرجّح ≈٧٦٫٧؛ نتأكّد أنّ الحدّ (٣٠) هو الفاعل لا انهيار الترجيح.
    const r = computeFinancialHealth(HONEST)
    expect(r.healthPct).toBeLessThan(76) // الفيتو خفضها فعلاً
    expect(r.healthPct).toBe(30)
  })
})

describe('§٦ — الاختبار المضادّ: شركةٌ سليمة لا تُفعّل فيتو', () => {
  it('كلّ مؤشّر عند الهدف → صحّة ≥ ٨٥ وفيتوات فارغة', () => {
    const r = computeFinancialHealth(HEALTHY)
    expect(r.healthPct).toBeGreaterThanOrEqual(85)
    expect(r.vetoes).toHaveLength(0)
  })
})

describe('§٤ — حدود الفيتوات الثلاثة', () => {
  it('تحصيل < ٧٠٪ يحدّ الصحّة عند ٤٥', () => {
    const r = computeFinancialHealth({ ...HEALTHY, collectionRate: 0.6 })
    expect(r.vetoes).toContain('COLLECTION_RATE')
    expect(r.healthPct).toBeLessThanOrEqual(45)
  })

  it('ذمم > ضعفَي الهدف تحدّ الصحّة عند ٥٠', () => {
    const r = computeFinancialHealth({ ...HEALTHY, receivables: 4_500_001, receivablesTarget: 2_000_000 })
    expect(r.vetoes).toContain('RECEIVABLES')
    expect(r.healthPct).toBeLessThanOrEqual(50)
  })

  it('ذمم عند ضعفَي الهدف تماماً لا تُفعّل الفيتو (الحدّ صارم >)', () => {
    const r = computeFinancialHealth({ ...HEALTHY, receivables: 4_000_000, receivablesTarget: 2_000_000 })
    expect(r.vetoes).not.toContain('RECEIVABLES')
  })

  it('سيولة فوريّة عند ٠٫٥ تماماً لا تُفعّل الفيتو (الحدّ صارم <)', () => {
    const r = computeFinancialHealth({ ...HEALTHY, instantLiquidity: 0.5 })
    expect(r.vetoes).not.toContain('INSTANT_LIQUIDITY')
  })
})

describe('§٧ — المواد صفراً فجوةُ بيانات لا تميّز', () => {
  it('مواد/إيراد = ٠ يُعاد توزيع وزنها على مجموعتها ولا تظهر في التفصيل', () => {
    const r = computeFinancialHealth(HONEST)
    expect(r.breakdown.materialsToRevenue).toBeUndefined()
    // مجموعة الكفاءة (١٥ نقطة) ما زالت مُمثَّلة عبر الرواتب + الإيراد/موظّف.
    expect(r.breakdown.payrollToRevenue).toBeGreaterThan(0)
    expect(r.breakdown.revenuePerDirectEmployee).toBeGreaterThan(0)
  })

  it('صفر المواد لا يُحتسَب ١٠٠ (لا ينفخ الصحّة كأنّه مثاليّ)', () => {
    // لو احتُسب ١٠٠ لظهر بمساهمة ٥ نقاط؛ الغياب يُبقي وزن المجموعة موزَّعاً لا مُضخَّماً.
    const withMaterials = computeFinancialHealth({ ...HONEST, materialsToRevenue: 0.30 })
    // إضافة مؤشّر ثالثٍ جيّد للمجموعة لا يقلب النتيجة (كلاهما محدود بالفيتو ٣٠ هنا)،
    // لكن التفصيل يجب أن يُظهر المؤشّر حين يُقاس فعلاً.
    expect(withMaterials.breakdown.materialsToRevenue).toBeGreaterThan(0)
  })
})
