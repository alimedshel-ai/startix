import { describe, expect, it } from 'vitest'

import { FINANCE_CONFIG } from './financeMaturity'
import { financeAutoAnswers, HIDDEN_IDS, layerFinanceConfig, SIZE_ML_IDS } from './finMaturityLayering'

const allIds = (c: { sections: { questions: { id: string }[] }[] }) =>
  c.sections.flatMap((s) => s.questions.map((q) => q.id))

describe('finMaturityLayering — تقسيم طبقة نضج المالية (ح٥)', () => {
  it('تُخفى ٣ تكرارات + ٤ مُجابة آليًّا دائمًا (لا تُلمس financeMaturity)', () => {
    const layered = layerFinanceConfig(FINANCE_CONFIG, { isSmall: false })
    const ids = allIds(layered)
    for (const h of ['fin_asset_9', 'fin_cost_6', 'fin_risk_7']) expect(ids).not.toContain(h)
    for (const a of ['fin_rep_8', 'fin_debt_2', 'fin_debt_3', 'fin_gov_10']) expect(ids).not.toContain(a)
    // الأصول تبقى ظاهرة
    for (const keep of ['fin_rep_6', 'fin_plan_7', 'fin_plan_9']) expect(ids).toContain(keep)
    // المصدر الأصليّ لم يُمَس (١٠٠ سؤال كما هو)
    expect(allIds(FINANCE_CONFIG)).toHaveLength(100)
  })

  it('الشركة الصغيرة لا ترى أسئلة الحجم (Z-Score/WACC…)؛ الكبيرة تراها', () => {
    const small = allIds(layerFinanceConfig(FINANCE_CONFIG, { isSmall: true }))
    const large = allIds(layerFinanceConfig(FINANCE_CONFIG, { isSmall: false }))
    for (const sz of ['fin_debt_4', 'fin_risk_9', 'fin_gov_1']) {
      expect(small).not.toContain(sz)
      expect(large).toContain(sz)
    }
    expect(small.length).toBeLessThan(large.length)
    expect(large.length).toBe(large.length) // large = 100 − 3 hidden − 4 auto = 93
    expect(large).toHaveLength(93)
  })

  it('كل معرّفات الإخفاء/الحجم موجودة فعلًا في FINANCE_CONFIG (لا معرّف شبح)', () => {
    const ids = new Set(allIds(FINANCE_CONFIG))
    for (const id of [...HIDDEN_IDS, ...SIZE_ML_IDS]) expect(ids.has(id)).toBe(true)
  })

  it('fin_debt_2 يُجاب على عتبة السؤال المعروض <٠٫٥ (بند ٦)', () => {
    const yes = financeAutoAnswers({ FINQ_DEBT: 7, FINQ_EQUITY: 100 }, undefined).find((r) => r.id === 'fin_debt_2')
    expect(yes?.value).toBe('yes') // 0.07 < 0.5
    const no = financeAutoAnswers({ FINQ_DEBT: 80, FINQ_EQUITY: 100 }, undefined).find((r) => r.id === 'fin_debt_2')
    expect(no?.value).toBe('no')   // 0.8 ≥ 0.5
  })

  it('الحوكمة س١٠ «نعم» دائمًا؛ والقروض «نعم» عند وجودها؛ بلا اختلاق للباقي', () => {
    const rows = financeAutoAnswers({}, [{ lender: 'أ', balance: 1, installment: 1 }])
    expect(rows.find((r) => r.id === 'fin_gov_10')?.value).toBe('yes')
    expect(rows.find((r) => r.id === 'fin_debt_3')?.value).toBe('yes')
    expect(rows.find((r) => r.id === 'fin_rep_8')).toBeUndefined() // لا شرائح ⇒ لا اشتقاق
  })
})
