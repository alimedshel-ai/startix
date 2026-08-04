import { describe, expect, it } from 'vitest'

import {
  matchLever,
  hrImpactResult,
  hrLeverGoal,
  hrGoalLineForText,
} from './hrInitiativeImpact'
import { FINANCIAL_INDICATOR_IDS, type QuantActuals } from './hrQuantIndicators'

// المرجع: E=25 · S=6000 · R=3,000,000 · تسرّب حاليّ 18٪ (هدف 10٪) →
// turnoverCost = 25 × 0.08 × 6000 × 3 = 36,000 ريال/سنة (hrFinancialImpact).
const BASIS = { headcount: 25, avgMonthlySalary: 6000, annualRevenue: 3_000_000 }
const ACTUALS: QuantActuals = {
  [FINANCIAL_INDICATOR_IDS.turnover]: 18, // KPI_STR_02
  [FINANCIAL_INDICATOR_IDS.absence]: 6,   // KPI_TAC_10 (هدف 2)
}

describe('matchLever — مطابقة نصّ المبادرة برافع §د', () => {
  it('يطابق التسرّب رغم التشكيل وصيَغ المرادفات', () => {
    expect(matchLever('🔧 معالجة: ارتفاع معدّل التسرّب الوظيفيّ')).toBe('turnover')
    expect(matchLever('خفض دوران الموظفين')).toBe('turnover')
  })
  it('يطابق الغياب', () => {
    expect(matchLever('انضباط الحضور ومعالجة الغياب')).toBe('absence')
  })
  it('لا يطابق نصّاً بلا رافع', () => {
    expect(matchLever('تحسين تصميم الشعار والهويّة البصريّة')).toBeNull()
  })
})

describe('الرقعة F — الحالات الثلاث لمعيار القبول', () => {
  it('(١) بيانات §د مكتملة ← هدف يحوي رقم ريال مطابقاً للحساب', () => {
    const impact = hrImpactResult(BASIS, ACTUALS)
    expect(impact).not.toBeNull()

    const goal = hrLeverGoal('🔧 معالجة: ارتفاع التسرّب', ACTUALS, impact)
    expect(goal).not.toBeNull()
    expect(goal!.lever).toBe('turnover')
    expect(goal!.annualImpactSAR).toBe(36_000) // مطابق لـ turnoverCost
    expect(goal!.current).toBe(18)
    expect(goal!.target).toBe(10)

    const line = hrGoalLineForText('🔧 معالجة: ارتفاع التسرّب', ACTUALS, impact)
    expect(line).toContain('ريال')
    expect(line).toContain('§د')
    expect(line).toContain('خفض') // اتجاه lower
  })

  it('(٢) §د ناقصة (بلا إيراد) ← «مقترح» بلا رقم مختلَق', () => {
    const impact = hrImpactResult({ headcount: 25, avgMonthlySalary: 6000 }, ACTUALS)
    expect(impact).toBeNull()
    expect(hrGoalLineForText('🔧 معالجة: ارتفاع التسرّب', ACTUALS, impact)).toBeNull()
  })

  it('(٣) راتب خارج النطاق (>٥٠٬٠٠٠) ← الحساب يمضي (تنبيه لا منع)', () => {
    const impact = hrImpactResult({ ...BASIS, avgMonthlySalary: 60_000 }, ACTUALS)
    expect(impact).not.toBeNull() // لا يُمنَع التوليد
    const goal = hrLeverGoal('🔧 معالجة: ارتفاع التسرّب', ACTUALS, impact)
    expect(goal!.annualImpactSAR).toBe(360_000) // 25×0.08×60000×3
  })
})

describe('حواف — لا اختلاق للرقم', () => {
  it('نصّ مطابق لكن الرافع بلا قيمة فعليّة مُدخَلة ← null', () => {
    const impact = hrImpactResult(BASIS, ACTUALS)
    // الشغور (KPI_TAC_02) غير مُدخَل في ACTUALS → لا هدف
    expect(hrLeverGoal('بطء التوظيف وارتفاع الشغور', ACTUALS, impact)).toBeNull()
  })
  it('نصّ بلا رافع ← null رغم اكتمال §د', () => {
    const impact = hrImpactResult(BASIS, ACTUALS)
    expect(hrGoalLineForText('تطوير الموقع الإلكترونيّ', ACTUALS, impact)).toBeNull()
  })
})
