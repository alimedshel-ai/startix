import { describe, expect, it } from 'vitest'

import { deriveArAging, sumLoans, toLatinDigits, weightedAvgRate } from './finAgingDerive'

describe('finAgingDerive — اشتقاق إجماليات الذمم/القروض من التفاصيل (§ت٣أ٢)', () => {
  it('FINQ_AR = مجموع قيَم الشرائح الأربع', () => {
    const r = deriveArAging({
      FINQ_AR_B1_V: 100_000, FINQ_AR_B2_V: 60_000, FINQ_AR_B3_V: 30_000, FINQ_AR_B4_V: 10_000,
    })
    expect(r?.value).toBe(200_000)
  })

  it('المتأخر = B3 + B4 فقط (فوق 60 يومًا) — قيمةً وعددًا', () => {
    const r = deriveArAging({
      FINQ_AR_B1_V: 100_000, FINQ_AR_B1_N: 5,
      FINQ_AR_B2_V: 60_000, FINQ_AR_B2_N: 3,
      FINQ_AR_B3_V: 30_000, FINQ_AR_B3_N: 2,
      FINQ_AR_B4_V: 10_000, FINQ_AR_B4_N: 1,
    })
    expect(r?.overdueV).toBe(40_000) // 30k + 10k
    expect(r?.overdueN).toBe(3)      // 2 + 1
  })

  it('اختبار القلب: تغيير شريحة يقلب الإجمالي والمتأخر', () => {
    const before = deriveArAging({ FINQ_AR_B1_V: 100_000, FINQ_AR_B3_V: 30_000 })
    const after = deriveArAging({ FINQ_AR_B1_V: 100_000, FINQ_AR_B3_V: 90_000 })
    expect(before?.value).toBe(130_000)
    expect(after?.value).toBe(190_000)
    expect(before?.overdueV).toBe(30_000)
    expect(after?.overdueV).toBe(90_000)
  })

  it('بلا أي شريحة ⇒ null (يبقى الإجمالي اليدويّ fallback)', () => {
    expect(deriveArAging({})).toBeNull()
    expect(deriveArAging({ FINQ_CURR_LIAB: 5 })).toBeNull()
  })

  it('sumLoans يجمع الأرصدة والأقساط؛ القائمة الفارغة ⇒ null', () => {
    const r = sumLoans([
      { lender: 'الأهلي', balance: 500_000, installment: 12_000 },
      { lender: 'الراجحي', balance: 300_000, installment: 8_000 },
    ])
    expect(r).toEqual({ debt: 800_000, inst: 20_000 })
    expect(sumLoans([])).toBeNull()
    expect(sumLoans(undefined)).toBeNull()
  })

  it('ح٣: weightedAvgRate = متوسط الفائدة مرجّحًا بالأرصدة؛ بلا أسعار ⇒ null', () => {
    const r = weightedAvgRate([
      { lender: 'أ', balance: 800_000, installment: 0, rate: 5 },
      { lender: 'ب', balance: 200_000, installment: 0, rate: 10 },
    ])
    expect(r).toBeCloseTo(6, 5) // (5×800k + 10×200k) ÷ 1م = 6
    expect(weightedAvgRate([{ lender: 'ج', balance: 100_000, installment: 0 }])).toBeNull()
    expect(weightedAvgRate([])).toBeNull()
  })

  it('toLatinDigits يحوّل الأرقام العربية-الهندية والفارسية', () => {
    expect(toLatinDigits('١٢٣٤٥')).toBe('12345')
    expect(toLatinDigits('۹۸۷')).toBe('987')
    expect(toLatinDigits('50000')).toBe('50000')
  })
})
