import { describe, expect, it } from 'vitest'

import {
  absenceImpact,
  computeHrFinancialImpact,
  enpsImpact,
  hrCostImpact,
  turnoverCost,
  vacancyImpact,
  type HrFinancialInputs,
} from './hrFinancialImpact'

// الشركة المرجعيّة في docs/HR_ASSESSMENT_TRANSFER_SPEC.md §د-٥.
const REF: HrFinancialInputs = { headcount: 25, avgMonthlySalary: 6000, annualRevenue: 3_000_000 }

describe('§د-١ — معادلات التحويل مقابل أمثلة الوثيقة المُصحَّحة', () => {
  it('تكلفة التسرّب ١٨٪→١٠٪ = ٣٦٬٠٠٠', () => {
    expect(turnoverCost(REF, { current: 18, target: 10 })).toBeCloseTo(36_000, 0)
  })

  it('أثر الغياب ٨٪→٢٪ = ١٨٠٬٠٠٠ (المُصحَّح، لا ١٬٩٨٩٬٠٠٠)', () => {
    expect(absenceImpact(REF, { current: 8, target: 2 })).toBeCloseTo(180_000, 0)
  })

  it('أثر الشغور ١٢٪→٥٪ = ١٧٨٬٥٠٠', () => {
    expect(vacancyImpact(REF, { current: 12, target: 5 })).toBeCloseTo(178_500, 0)
  })

  it('أثر eNPS ٢٥→٥٠ = ٢٢٥٬٠٠٠', () => {
    expect(enpsImpact(REF, { current: 25, target: 50 })).toBeCloseTo(225_000, 0)
  })

  it('أثر تكلفة HR ٣٠٪→٢٥٪ = ١٥٠٬٠٠٠', () => {
    expect(hrCostImpact(REF, { current: 30, target: 25 })).toBeCloseTo(150_000, 0)
  })
})

describe('حرّاس السلامة (نمط IFERROR)', () => {
  it('مدخل ناقص/صفر → أثر ٠ لا NaN', () => {
    expect(turnoverCost({ headcount: 0, avgMonthlySalary: 6000, annualRevenue: 3_000_000 }, { current: 18, target: 10 })).toBe(0)
    expect(absenceImpact({ headcount: 25, avgMonthlySalary: 6000, annualRevenue: 0 }, { current: 8, target: 2 })).toBe(0)
  })

  it('بلغ الهدف أصلاً (حاليّ ≤ هدف) → لا توفير (٠، لا سالب)', () => {
    expect(turnoverCost(REF, { current: 8, target: 10 })).toBe(0)
    expect(absenceImpact(REF, { current: 2, target: 2 })).toBe(0)
  })

  it('eNPS تراجع (هدف ≤ حاليّ) → ٠', () => {
    expect(enpsImpact(REF, { current: 50, target: 25 })).toBe(0)
  })
})

describe('التجميع — استبعاد ازدواج eNPS (حاشية §د ²)', () => {
  const res = computeHrFinancialImpact(REF, {
    turnoverPct: { current: 18, target: 10 },
    absencePct: { current: 8, target: 2 },
    vacancyPct: { current: 12, target: 5 },
    enpsPoints: { current: 25, target: 50 },
    hrCostPct: { current: 30, target: 25 },
  })

  it('الإجمالي يستبعد eNPS = ٣٦٬٠٠٠+١٨٠٬٠٠٠+١٧٨٬٥٠٠+١٥٠٬٠٠٠ = ٥٤٤٬٥٠٠', () => {
    expect(res.totalSavingSAR).toBe(544_500)
  })

  it('eNPS محسوب لكن غير مُدرَج (countedInTotal=false)', () => {
    expect(res.enps.annualImpactSAR).toBeCloseTo(225_000, 0)
    expect(res.enps.countedInTotal).toBe(false)
  })

  it('الإجمالي نسبة معقولة من الإيراد (٥٤٤٬٥٠٠/٣M = ١٨٫٢٪) لا ٨٦٪ المبالَغة', () => {
    expect(res.totalAsPctOfRevenue).toBe(18.2)
    expect(res.totalAsPctOfRevenue).toBeLessThan(25)
  })
})
