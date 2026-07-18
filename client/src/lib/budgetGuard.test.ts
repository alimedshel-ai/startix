import { describe, expect, it } from 'vitest'

import { budgetStatus } from './budgetGuard'

describe('budgetGuard.budgetStatus', () => {
  it('Σ cost ≤ budget → أخضر (لا تجاوز)', () => {
    const s = budgetStatus([100, 200], 500)
    expect(s.spent).toBe(300)
    expect(s.overBudget).toBe(false)
    expect(s.remaining).toBe(200)
    expect(s.pct).toBe(60)
  })

  it('Σ cost > budget → تجاوز (تحذير)', () => {
    const s = budgetStatus([300, 300], 500)
    expect(s.spent).toBe(600)
    expect(s.overBudget).toBe(true)
    expect(s.remaining).toBe(-100)
    expect(s.pct).toBe(120)
  })

  it('بند قديم بلا cost (null) + نصّ Decimal → يعمل بلا كسر', () => {
    const s = budgetStatus([null, '150.00', 50, undefined], 300)
    expect(s.spent).toBe(200)      // null/undefined → 0، "150.00" → 150
    expect(s.overBudget).toBe(false)
  })

  it('بلا ميزانيّة (null/0) → لا حظر، لا نسبة', () => {
    expect(budgetStatus([100, 200], null).overBudget).toBe(false)
    expect(budgetStatus([100, 200], null).budget).toBeNull()
    expect(budgetStatus([100], 0).budget).toBeNull()     // 0 = بلا ميزانيّة
    expect(budgetStatus([100], 0).pct).toBeNull()
  })

  it('قائمة فارغة → spent صفر', () => {
    expect(budgetStatus([], 1000).spent).toBe(0)
    expect(budgetStatus([], 1000).overBudget).toBe(false)
  })
})
