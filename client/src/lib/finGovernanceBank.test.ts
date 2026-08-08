import { describe, expect, it } from 'vitest'

import { GOVERNANCE_BANK, GOVERNANCE_QUESTION_COUNT, scoreGovernance } from './finGovernanceBank'

describe('finGovernanceBank — بنك الحوكمة التنظيميّة (ح٦، ٢٥ سؤالًا)', () => {
  it('٥ مجموعات × ٥ = ٢٥ سؤالًا، ومعرّفات فريدة', () => {
    expect(GOVERNANCE_BANK).toHaveLength(5)
    expect(GOVERNANCE_QUESTION_COUNT).toBe(25)
    GOVERNANCE_BANK.forEach((g) => expect(g.questions).toHaveLength(5))
    const ids = GOVERNANCE_BANK.flatMap((g) => g.questions.map((q) => q.id))
    expect(new Set(ids).size).toBe(25)
  })

  it('التقييم: نعم=١٠/جزئياً=٥/لا=٠، وغير المُجاب صفر في المقام الكامل', () => {
    const r = scoreGovernance({ t1_1: 'yes', t1_2: 'yes', t1_3: 'yes', t1_4: 'yes', t1_5: 'yes' })
    expect(r.byGroup.t1).toBe(100)          // كل ت١ نعم
    expect(r.answered).toBe(5)
    expect(r.overallPct).toBe(20)           // ٥٠ نقطة ÷ (٢٥×١٠) = ٢٠٪
  })

  it('ق١٠: الشركة الصغيرة تُستبعد أسئلة sizeML من المقام (٣ أسئلة)', () => {
    const full = scoreGovernance({}, { isSmall: false })
    const small = scoreGovernance({}, { isSmall: true })
    expect(full.applicable).toBe(25)
    expect(small.applicable).toBe(22)       // 25 − 3 (t1_3, t2_5, t5_4)
  })
})
