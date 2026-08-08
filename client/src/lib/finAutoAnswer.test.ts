import { describe, expect, it } from 'vitest'

import { autoAnswers } from './finAutoAnswer'

describe('finAutoAnswer — الأسئلة المُجابة آليًّا (ح٤، ق٢، بلا اختلاق)', () => {
  it('أعمار الذمم >٩٠: +90 تتجاوز ٢٥٪ ⇒ «لا»؛ دونها ⇒ «نعم»', () => {
    const bad = autoAnswers({ finq: { FINQ_AR_B1_V: 100_000, FINQ_AR_B4_V: 100_000 } })
    expect(bad.find((a) => a.q === 'reports_ar_aging_over_90')?.value).toBe('no') // 50٪
    const ok = autoAnswers({ finq: { FINQ_AR_B1_V: 900_000, FINQ_AR_B4_V: 50_000 } })
    expect(ok.find((a) => a.q === 'reports_ar_aging_over_90')?.value).toBe('yes') // 5٪
  })

  it('جدول القروض: قائمة غير فارغة ⇒ «نعم»', () => {
    const r = autoAnswers({ loans: [{ lender: 'أ', balance: 100, installment: 10 }] })
    expect(r.find((a) => a.q === 'debt_schedule_exists')?.value).toBe('yes')
  })

  it('الدين/الملكية بعتبة المحرّك ≤١٫٠ (لا <٠٫٥)', () => {
    expect(autoAnswers({ finq: { FINQ_DEBT: 800_000, FINQ_EQUITY: 1_000_000 } })
      .find((a) => a.q === 'debt_equity_within_threshold')?.value).toBe('yes') // 0.8 ≤ 1
    expect(autoAnswers({ finq: { FINQ_DEBT: 1_500_000, FINQ_EQUITY: 1_000_000 } })
      .find((a) => a.q === 'debt_equity_within_threshold')?.value).toBe('no')  // 1.5 > 1
  })

  it('لا اختلاق: حقول فارغة ⇒ لا إجابة آليّة (السؤال يبقى مطروحًا)', () => {
    expect(autoAnswers({})).toEqual([])
    expect(autoAnswers({ finq: { FINQ_CURR_LIAB: 5 } })).toEqual([])
    // ملكية صفر ⇒ لا قسمة، لا إجابة
    expect(autoAnswers({ finq: { FINQ_DEBT: 100, FINQ_EQUITY: 0 } })
      .some((a) => a.q === 'debt_equity_within_threshold')).toBe(false)
  })
})
