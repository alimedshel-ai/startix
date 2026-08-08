import { describe, expect, it } from 'vitest'

import { financeContradictions } from './finContradictions'

describe('finContradictions — تحذيرات تناقض الأرقام (ح٥/بند٥)', () => {
  it('حقوق الملكية > إجمالي الأصول', () => {
    expect(financeContradictions({ FINQ_EQUITY: 900, FINQ_TOTAL_ASSETS: 500 }, {})).toHaveLength(1)
    expect(financeContradictions({ FINQ_EQUITY: 400, FINQ_TOTAL_ASSETS: 500 }, {})).toHaveLength(0)
  })
  it('الذمم > الأصول المتداولة', () => {
    expect(financeContradictions({ FINQ_AR: 600, FINQ_CURR_ASSET: 500 }, {}).some((m) => m.includes('الذمم'))).toBe(true)
  })
  it('مواد سنويّة > الإيراد مع ربح موجب', () => {
    expect(financeContradictions({ FND_MAT: 100_000, FINQ_NET_PROFIT: 50_000 }, { annualRevenue: 1_000_000 })).toHaveLength(1) // 1.2م > 1م + ربح
    expect(financeContradictions({ FND_MAT: 100_000, FINQ_NET_PROFIT: 50_000 }, { annualRevenue: 2_000_000 })).toHaveLength(0) // 1.2م < 2م
  })
  it('لا تحذير من حقلٍ غائب (لا اختلاق)', () => {
    expect(financeContradictions({ FINQ_EQUITY: 900 }, {})).toHaveLength(0) // الأصول غائبة
    expect(financeContradictions({}, {})).toHaveLength(0)
  })
})
