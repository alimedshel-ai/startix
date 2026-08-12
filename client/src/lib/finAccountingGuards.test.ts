import { describe, it, expect } from 'vitest'
import { accountingGuards } from './finAccountingGuards'

describe('accountingGuards — حرّاس التناقض المحاسبيّ الثلاثة', () => {
  it('حقوق الملكية > الأصول ⇒ حارس equity_gt_assets', () => {
    const w = accountingGuards({ equity: 500, totalAssets: 300 })
    expect(w.map((x) => x.key)).toEqual(['equity_gt_assets'])
  })
  it('الذمم > الأصول المتداولة ⇒ حارس ar_gt_current', () => {
    const w = accountingGuards({ receivables: 200, currentAssets: 150 })
    expect(w.map((x) => x.key)).toEqual(['ar_gt_current'])
  })
  it('المواد السنويّة > الإيراد مع مجمل ربح موجب ⇒ حارس materials_gt_revenue', () => {
    // ١٠٠٠٠×١٢=١٢٠٠٠٠ > ١٠٠٠٠٠ · مجمل ٥٠٠٠ > ٠
    const w = accountingGuards({ materialsMonthly: 10000, annualRevenue: 100000, grossProfit: 5000 })
    expect(w.map((x) => x.key)).toEqual(['materials_gt_revenue'])
  })
  it('المواد تتجاوز الإيراد لكن مجمل الربح ≤ ٠ ⇒ لا حارس (لا تناقض)', () => {
    expect(accountingGuards({ materialsMonthly: 10000, annualRevenue: 100000, grossProfit: -1 })).toEqual([])
  })
  it('قيم سليمة ⇒ لا حرّاس', () => {
    expect(accountingGuards({ equity: 100, totalAssets: 300, receivables: 50, currentAssets: 150 })).toEqual([])
  })
  it('طرفٌ غائب ⇒ لا حكم (لا اختلاق)', () => {
    expect(accountingGuards({ equity: 500 })).toEqual([])
    expect(accountingGuards({})).toEqual([])
  })
  it('مساواة ليست تجاوزًا (٣٠٠ = ٣٠٠) ⇒ لا حارس', () => {
    expect(accountingGuards({ equity: 300, totalAssets: 300 })).toEqual([])
  })
  it('الحرّاس الثلاثة معًا يُفعَّلون معًا', () => {
    const w = accountingGuards({
      equity: 500, totalAssets: 300,
      receivables: 200, currentAssets: 150,
      materialsMonthly: 10000, annualRevenue: 100000, grossProfit: 5000,
    })
    expect(w.map((x) => x.key)).toEqual(['equity_gt_assets', 'ar_gt_current', 'materials_gt_revenue'])
  })
})
