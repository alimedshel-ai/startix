import { describe, expect, it } from 'vitest'

import { computeFinancialHealth, type FinancialKpis } from './financialHealth'
import { deriveFinancialKpis } from './finQuantDerive'
import { deriveQuantActual } from './hrQuantDerive'

// قاعدة NaN لكل الحقول — computeFinancialHealth يعامل NaN «غائبًا» (finite) فيُعيد
// التوزيع؛ نطبع فوقها الجزء المُشتقّ لبناء FinancialKpis كامل النوع للأنبوب.
const NAN_BASE: FinancialKpis = {
  instantLiquidity: NaN, quickRatio: NaN, collectionRate: NaN, receivables: NaN,
  receivablesTarget: NaN, debtToEquity: NaN, workingCapital: NaN, payrollToRevenue: NaN,
  materialsToRevenue: NaN, revenuePerDirectEmployee: NaN, netMargin: NaN, grossMargin: NaN, roe: NaN,
}

describe('finQuantDerive — بناء FinancialKpis من البنك المالي (FIN_QUANT_CROSSOVER §2)', () => {
  it('السيولة الفوريّة = النقد ÷ الخصوم المتداولة', () => {
    expect(deriveFinancialKpis({ FND_CASH: 110_000, FINQ_CURR_LIAB: 1_000_000 }).instantLiquidity).toBeCloseTo(0.11, 5)
  })
  it('السريعة = (نقد + ذمم) ÷ الخصوم', () => {
    expect(deriveFinancialKpis({ FND_CASH: 500_000, FINQ_AR: 700_000, FINQ_CURR_LIAB: 500_000 }).quickRatio).toBeCloseTo(2.4, 5)
  })
  it('نسبة التحصيل = المُحصَّل ÷ الذمم', () => {
    expect(deriveFinancialKpis({ FINQ_AR_COLLECTED: 92, FINQ_AR: 100 }).collectionRate).toBeCloseTo(0.92, 5)
  })
  it('رأس المال العامل = الأصول − الخصوم (يقبل السالب)', () => {
    expect(deriveFinancialKpis({ FINQ_CURR_ASSET: 3_000_000, FINQ_CURR_LIAB: 631_284 }).workingCapital).toBe(2_368_716)
    expect(deriveFinancialKpis({ FINQ_CURR_ASSET: 100, FINQ_CURR_LIAB: 500 }).workingCapital).toBe(-400)
  })
  it('الدين/حقوق الملكيّة، والمواد/إيراد ((المواد×12)÷الإيراد)', () => {
    expect(deriveFinancialKpis({ FINQ_DEBT: 720_000, FINQ_EQUITY: 1_000_000 }).debtToEquity).toBeCloseTo(0.72, 5)
    expect(deriveFinancialKpis({ FND_MAT: 25_000, FND_ANNUAL_REVENUE: 1_000_000 }).materialsToRevenue).toBeCloseTo(0.30, 5)
  })
  it('الهوامش والعائد على حقوق الملكيّة', () => {
    const k = deriveFinancialKpis({ FINQ_NET_PROFIT: 340_000, FINQ_GROSS_PROFIT: 970_000, FND_ANNUAL_REVENUE: 1_000_000, FINQ_EQUITY: 500_000 })
    expect(k.netMargin).toBeCloseTo(0.34, 5)
    expect(k.grossMargin).toBeCloseTo(0.97, 5)
    expect(k.roe).toBeCloseTo(0.68, 5)
  })

  // ── §أ: المصدر الواحد — يُقرآن من طبقة HR، لا يُحسبان مستقلًّا ──
  it('§أ-١: الإيراد/موظّف = KPI_STR_06 حرفيًّا (لا صيغة موازية)', () => {
    const inp = { FND_ANNUAL_REVENUE: 3_000_000, FND_HEADCOUNT: 20 }
    expect(deriveFinancialKpis(inp).revenuePerDirectEmployee).toBe(deriveQuantActual('KPI_STR_06', inp))
    expect(deriveFinancialKpis(inp).revenuePerDirectEmployee).toBe(150_000)
  })
  it('§أ-٢: تكلفة العمالة/إيراد = KPI_STR_01 ÷ 100 (٪ → نسبة)', () => {
    const inp = { HRQ_HR_COST_YEAR: 250_000, FND_ANNUAL_REVENUE: 1_000_000 }
    expect(deriveQuantActual('KPI_STR_01', inp)).toBe(25) // ٪
    expect(deriveFinancialKpis(inp).payrollToRevenue).toBeCloseTo(0.25, 5)
  })

  // ── §0-4: لا اختلاق — مقامٌ غائب/صفر ⇒ الحقل غائب (لا NaN ولا صفر) ──
  it('مقام غائب أو صفر ⇒ الحقل غائب من المخرَج', () => {
    expect('instantLiquidity' in deriveFinancialKpis({ FND_CASH: 100 })).toBe(false)
    expect('instantLiquidity' in deriveFinancialKpis({ FND_CASH: 100, FINQ_CURR_LIAB: 0 })).toBe(false)
    expect('revenuePerDirectEmployee' in deriveFinancialKpis({ FND_ANNUAL_REVENUE: 1_000_000 })).toBe(false)
    expect('payrollToRevenue' in deriveFinancialKpis({ FND_ANNUAL_REVENUE: 1_000_000 })).toBe(false)
  })

  // ── حالة القبول الحاكمة: الأنبوب الكامل يُنتج طوارئ ٣٠ (الفيتو يعمل عبر الاشتقاق) ──
  // (اختبار الفيتو النقيّ موجود في financialHealth.test.ts §٦ — هنا نتأكّد أن الاشتقاق
  //  يغذّي الفيتو صحيحًا عبر الأنبوب، لا نكرّر اختبار الدالّة النقيّة.)
  it('حارس الأنبوب: سيولة 0.11 + ربحيّة منتفخة ⇒ computeFinancialHealth=30 + فيتو INSTANT_LIQUIDITY', () => {
    const derived = deriveFinancialKpis({
      FND_CASH: 110_000, FINQ_CURR_LIAB: 1_000_000,       // سيولة فوريّة 0.11
      FINQ_AR: 2_380_000, FINQ_AR_COLLECTED: 2_189_600,   // سريعة مرتفعة + تحصيل 0.92
      FINQ_NET_PROFIT: 340_000, FINQ_GROSS_PROFIT: 970_000, FND_ANNUAL_REVENUE: 1_000_000, FINQ_EQUITY: 500_000,
    })
    const r = computeFinancialHealth({ ...NAN_BASE, ...derived })
    expect(r.healthPct).toBe(30)
    expect(r.vetoes).toContain('INSTANT_LIQUIDITY')
  })
})
