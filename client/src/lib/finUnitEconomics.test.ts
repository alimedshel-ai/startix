import { describe, it, expect } from 'vitest'
import { productEconomics, unitEconomics, type Product } from './finUnitEconomics'

const p = (o: Partial<Product>): Product =>
  ({ id: o.id ?? 'x', name: o.name ?? 'منتج', varCostUnit: o.varCostUnit ?? 0, priceUnit: o.priceUnit ?? 0, monthlyUnits: o.monthlyUnits })

describe('productEconomics — اقتصاديات منتجٍ واحد', () => {
  it('رابح: سعر ٦٠٠ متغيّرة ٢٠٠ ⇒ هامش ٤٠٠ (٦٦٫٧٪) · أدنى سعر ٢٠٠', () => {
    const r = productEconomics(p({ priceUnit: 600, varCostUnit: 200 }))!
    expect(r.contributionMargin).toBe(400)
    expect(Math.round(r.contributionMarginPct)).toBe(67)
    expect(r.minPrice).toBe(200)
    expect(r.profitable).toBe(true)
    expect(r.monthlyContribution).toBeNull()
  })
  it('خاسر: سعر ٢٠٠ متغيّرة ٣٠٠ ⇒ هامش سالب · غير رابح', () => {
    const r = productEconomics(p({ priceUnit: 200, varCostUnit: 300 }))!
    expect(r.contributionMargin).toBe(-100)
    expect(r.profitable).toBe(false)
  })
  it('وحدات شهريّة ⇒ مساهمة شهريّة = الهامش × الوحدات', () => {
    const r = productEconomics(p({ priceUnit: 600, varCostUnit: 200, monthlyUnits: 100 }))!
    expect(r.monthlyContribution).toBe(40000)
  })
  it('سعر مفقود/صفر ⇒ null (لا اختلاق)', () => {
    expect(productEconomics(p({ priceUnit: 0, varCostUnit: 100 }))).toBeNull()
  })
})

describe('unitEconomics — عبر المنتجات', () => {
  const products = [
    p({ id: 'a', name: 'أ', priceUnit: 600, varCostUnit: 200, monthlyUnits: 100 }), // هامش ٤٠٠×١٠٠=٤٠٠٠٠
    p({ id: 'b', name: 'ب', priceUnit: 200, varCostUnit: 300, monthlyUnits: 50 }),  // خاسر
    p({ id: 'c', name: 'ج', priceUnit: 100, varCostUnit: 90, monthlyUnits: 200 }),  // هامش ١٠×٢٠٠=٢٠٠٠
  ]
  it('يكشف المنتج الخاسر ويحسب المساهمة الإجماليّة', () => {
    const r = unitEconomics(products, 30000)
    expect(r.lossMaking.map((x) => x.id)).toEqual(['b'])
    // إجمالي = ٤٠٠٠٠ + (−١٠٠×٥٠=−٥٠٠٠) + ٢٠٠٠ = ٣٧٠٠٠
    expect(r.totalMonthlyContribution).toBe(37000)
    expect(r.coversFixed).toBe(true) // ٣٧٠٠٠ ≥ ٣٠٠٠٠
  })
  it('الأضعف هامشًا = ب (سالب)', () => {
    expect(unitEconomics(products).worst?.id).toBe('b')
  })
  it('لا ثابتة/لا وحدات ⇒ coversFixed = null', () => {
    expect(unitEconomics([p({ priceUnit: 600, varCostUnit: 200 })]).coversFixed).toBeNull()
  })
})
