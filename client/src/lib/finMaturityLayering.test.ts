import { describe, expect, it } from 'vitest'

import { FINANCE_CONFIG } from './financeMaturity'
import {
  AUTO_IDS, COND_AUTO_IDS, DEFERRED_IDS, financeAutoAnswers, financeTier, HIDDEN_IDS,
  layerFinanceConfig, MERGED_IDS, SIZE_K_IDS, SIZE_MK_IDS,
} from './finMaturityLayering'

const allIds = (c: { sections: { questions: { id: string }[] }[] }) =>
  c.sections.flatMap((s) => s.questions.map((q) => q.id))

// جاهزيّة كل الآليّ المشروط (التعادل + نقدية) — لبلوغ عدد الوثيقة (٢٢/٦٢/٨٢).
const ALL_TOOLS = { FINQ_FIXED_COSTS: 50_000, FINQ_VAR_COST_UNIT: 200, FINQ_PRICE_UNIT: 600, FND_CASH: 100_000 }
const answeredAll = new Set(financeAutoAnswers(ALL_TOOLS, []).map((a) => a.id))

describe('finMaturityLayering v3 — تقسيم الـ١٠٠ إلى فئة واحدة لكلٍّ', () => {
  it('التقسيم كامل: ٤+٤+٦+١+٣+٢٠+٤٠ مصنّفة + ٢٢ تبقى = ١٠٠، بلا تقاطع', () => {
    const ids = allIds(FINANCE_CONFIG)
    expect(ids).toHaveLength(100)

    const cats: Record<string, Set<string>> = {
      hidden: HIDDEN_IDS, auto: new Set(AUTO_IDS), merged: MERGED_IDS,
      deferred: DEFERRED_IDS, condAuto: COND_AUTO_IDS, sizeK: SIZE_K_IDS, sizeMk: SIZE_MK_IDS,
    }
    // أحجام الفئات كما في الوثيقة الموقَّعة.
    expect(HIDDEN_IDS.size).toBe(4)
    expect(new Set(AUTO_IDS).size).toBe(4)
    expect(MERGED_IDS.size).toBe(6)
    expect(DEFERRED_IDS.size).toBe(1)
    expect(COND_AUTO_IDS.size).toBe(3)
    expect(SIZE_K_IDS.size).toBe(20)
    expect(SIZE_MK_IDS.size).toBe(40)

    // لا تقاطع بين أيّ فئتين، وكلّ معرّف مصنّف موجود في الـ١٠٠.
    const seen = new Set<string>()
    for (const s of Object.values(cats)) for (const id of s) {
      expect(seen.has(id), `تكرار عبر الفئات: ${id}`).toBe(false)
      expect(ids, `معرّف مصنّف غير موجود: ${id}`).toContain(id)
      seen.add(id)
    }
    expect(seen.size).toBe(78)
    // الباقي «يبقى» = ٢٢ (ما تراه الصغيرة).
    const stay = ids.filter((id) => !seen.has(id))
    expect(stay).toHaveLength(22)
  })
})

describe('finMaturityLayering v3 — الطبقات الثلاث (بعد شحن الأدوات)', () => {
  const layer = (tier: 'small' | 'medium' | 'large') =>
    allIds(layerFinanceConfig(FINANCE_CONFIG, { tier, answeredIds: answeredAll }))

  it('صغيرة ٢٢ · متوسّطة ٦٢ · كبيرة ٨٢ (أعداد الوثيقة)', () => {
    expect(layer('small')).toHaveLength(22)
    expect(layer('medium')).toHaveLength(62)
    expect(layer('large')).toHaveLength(82)
  })

  it('[ك] تُخفى للصغيرة والمتوسّطة وتظهر للكبيرة فقط', () => {
    for (const k of ['fin_debt_4', 'fin_risk_9', 'fin_gov_8']) {
      expect(layer('small')).not.toContain(k)
      expect(layer('medium')).not.toContain(k)
      expect(layer('large')).toContain(k)
    }
  })

  it('[م/ك] تُخفى للصغيرة فقط وتظهر للمتوسّطة والكبيرة', () => {
    for (const mk of ['fin_gov_1', 'fin_asset_1', 'fin_sys_2']) {
      expect(layer('small')).not.toContain(mk)
      expect(layer('medium')).toContain(mk)
      expect(layer('large')).toContain(mk)
    }
  })

  it('المدموج/المُرحَّل/المخفيّ الجديد يُخفى من كل الأحجام', () => {
    for (const gone of ['fin_rep_1', 'fin_cash_8', 'fin_tax_10', 'fin_debt_6', 'fin_gov_3']) {
      expect(layer('small')).not.toContain(gone)
      expect(layer('large')).not.toContain(gone)
    }
  })

  it('financeTier: MICRO/SMALL→صغيرة · MEDIUM→متوسّطة · LARGE/مجهول→كبيرة', () => {
    expect(financeTier('MICRO')).toBe('small')
    expect(financeTier('SMALL')).toBe('small')
    expect(financeTier('MEDIUM')).toBe('medium')
    expect(financeTier('LARGE')).toBe('large')
    expect(financeTier(undefined)).toBe('large')
  })
})

describe('finMaturityLayering v3 — الآليّ المشروط (يُخفى عند الجاهزيّة فقط)', () => {
  it('بلا أدوات: plan_7/rep_4/cash_1 تبقى أسئلة (كبيرة = ٨٥)', () => {
    const large = allIds(layerFinanceConfig(FINANCE_CONFIG, { tier: 'large' })) // بلا answeredIds
    for (const c of ['fin_plan_7', 'fin_rep_4', 'fin_cash_1']) expect(large).toContain(c)
    expect(large).toHaveLength(85) // ٨٢ + ٣ مشروطة غير مُجابة
  })

  it('التعادل يُجاب حين تكتمل المدخلات الثلاثة فقط', () => {
    expect(financeAutoAnswers({ FINQ_FIXED_COSTS: 50_000, FINQ_VAR_COST_UNIT: 200, FINQ_PRICE_UNIT: 600 }, [])
      .find((a) => a.id === 'fin_plan_7')?.value).toBe('yes')
    // مدخل ناقص ⇒ لا يُجاب (يبقى سؤالًا)
    expect(financeAutoAnswers({ FINQ_FIXED_COSTS: 50_000, FINQ_PRICE_UNIT: 600 }, [])
      .some((a) => a.id === 'fin_plan_7')).toBe(false)
  })

  it('النقدية (cash_1/rep_4) تُجاب حين يوجد نقد افتتاحيّ فقط', () => {
    const withCash = financeAutoAnswers({ FND_CASH: 100_000 }, [])
    expect(withCash.some((a) => a.id === 'fin_cash_1')).toBe(true)
    expect(withCash.some((a) => a.id === 'fin_rep_4')).toBe(true)
    const noCash = financeAutoAnswers({}, [])
    expect(noCash.some((a) => a.id === 'fin_cash_1')).toBe(false)
    expect(noCash.some((a) => a.id === 'fin_rep_4')).toBe(false)
  })
})

describe('finMaturityLayering — الآليّ ح٥ (محفوظ من التوقيع السابق)', () => {
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
