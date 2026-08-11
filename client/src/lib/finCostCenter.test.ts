import { describe, it, expect } from 'vitest'
import {
  monthlyEquivalent, aggregatesByType, monthlyOpex, deriveAggregatesIntoFinq, costMap,
  type CostItem,
} from './finCostCenter'

const item = (p: Partial<CostItem>): CostItem =>
  ({ id: p.id ?? 'x', name: p.name ?? 'بند', type: p.type ?? 1, amount: p.amount ?? 0, recurrence: p.recurrence ?? 'monthly' })

describe('monthlyEquivalent — تطبيع الدورة إلى شهريّ', () => {
  it('شهريّ = المبلغ · ربعيّ ÷٣ · سنويّ ÷١٢ · مرّة-واحدة = ٠', () => {
    expect(monthlyEquivalent(item({ amount: 1200, recurrence: 'monthly' }))).toBe(1200)
    expect(monthlyEquivalent(item({ amount: 1200, recurrence: 'quarterly' }))).toBe(400)
    expect(monthlyEquivalent(item({ amount: 1200, recurrence: 'annual' }))).toBe(100)
    expect(monthlyEquivalent(item({ amount: 5000, recurrence: 'oneoff' }))).toBe(0)
  })
  it('مبلغ سالب/غير رقميّ ⇒ ٠ (لا يكسر)', () => {
    expect(monthlyEquivalent(item({ amount: -100 }))).toBe(0)
    expect(monthlyEquivalent(item({ amount: NaN }))).toBe(0)
  })
})

describe('monthlyOpex — يستثني CapEx(٦) ومسحوبات المالك(٧)', () => {
  it('يجمع التشغيليّة ويحذف ٦ و٧', () => {
    const items = [
      item({ type: 1, amount: 10000 }),           // ثابتة
      item({ type: 3, amount: 3000 }),            // تسويق
      item({ type: 6, amount: 50000, recurrence: 'oneoff' }), // CapEx — يُحذَف
      item({ type: 7, amount: 8000 }),            // مسحوبات — يُحذَف
    ]
    expect(monthlyOpex(items)).toBe(13000)
  })
})

describe('قرار ٢ — أسبقيّة البنود: المشتقّ يسود، وإلا يبقى المجمّع', () => {
  it('فئة فيها بنود ⇒ تُكتَب قيمتها المشتقّة وتُجمَّد؛ فئة بلا بنود ⇒ تبقى القديمة', () => {
    const finq = { FINQ_FIXED_COSTS: 99999, FINQ_MKT: 5000, FINQ_GOV: 12000 }
    const items = [
      item({ type: 1, amount: 8000, recurrence: 'monthly' }),  // ثابتة → FINQ_FIXED_COSTS
      item({ type: 1, amount: 12000, recurrence: 'annual' }),  // +١٠٠٠ شهريًّا
    ]
    const { finq: next, frozenFields } = deriveAggregatesIntoFinq(items, finq)
    expect(next.FINQ_FIXED_COSTS).toBe(9000)   // ٨٠٠٠ + ١٠٠٠ — البنود سادت على ٩٩٩٩٩
    expect(next.FINQ_MKT).toBe(5000)           // لا بنود تسويق ⇒ القيمة القديمة بقيت
    expect(next.FINQ_GOV).toBe(12000)          // لا بنود حكوميّة ⇒ بقيت
    expect(frozenFields).toContain('FINQ_FIXED_COSTS')
    expect(frozenFields).not.toContain('FINQ_MKT')
  })
  it('بلا بنود إطلاقًا ⇒ finq بلا تغيير (توافق العميل الحاليّ)', () => {
    const finq = { FINQ_FIXED_COSTS: 50000 }
    const { finq: next, frozenFields } = deriveAggregatesIntoFinq([], finq)
    expect(next).toEqual(finq)
    expect(frozenFields).toEqual([])
  })
})

describe('costMap — خريطة النِّسَب مرتّبة تنازليًّا', () => {
  it('يحسب النسبة ويرتّب الأكبر أوّلاً', () => {
    const map = costMap([
      item({ type: 1, amount: 8000 }),
      item({ type: 3, amount: 2000 }),
    ])
    expect(map[0].type).toBe(1)
    expect(map[0].monthly).toBe(8000)
    expect(Math.round(map[0].pct)).toBe(80)
    expect(map[1].pct).toBeCloseTo(20)
  })
})

describe('aggregatesByType — تجميع لكل نوع', () => {
  it('يجمع بنود النوع نفسه', () => {
    const agg = aggregatesByType([item({ type: 2, amount: 1000 }), item({ type: 2, amount: 500 })])
    expect(agg[2]).toBe(1500)
    expect(agg[1]).toBeUndefined()
  })
})
