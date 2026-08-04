import { describe, it, expect } from 'vitest'
import { GENERATED_STATUS, isSuggested, canPromote, isOrphan, missingFields } from './initiativeState'

describe('حالة المولَّدة (أ١)', () => {
  it('الحالة الابتدائية = «مقترح» لا «مخطّط»', () => {
    expect(GENERATED_STATUS).toBe('suggested')
    expect(isSuggested('suggested')).toBe(true)
    expect(isSuggested('planned')).toBe(false)
  })
})

describe('بوابة الترقية canPromote (أ٢)', () => {
  it('ترفض الانتقال بلا هدف (فشل)', () => {
    const r = canPromote({ objectiveId: null, level: 'operational', cost: 5000 })
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('goal')
  })
  it('تقبل حين تكتمل الحقول الثلاثة (نجاح)', () => {
    const r = canPromote({ objectiveId: 'obj-1', level: 'tactical', cost: 40000 })
    expect(r.ok).toBe(true)
    expect(r.missing).toHaveLength(0)
  })
  it('تُميّز «تكلفة غير مقدَّرة صراحةً» عن الناقصة (أ٢)', () => {
    const bare = canPromote({ objectiveId: 'obj-1', level: 'tactical', cost: null })
    expect(bare.ok).toBe(false)
    expect(bare.missing).toContain('cost')
    const ack = canPromote({ objectiveId: 'obj-1', level: 'tactical', cost: null }, { costUnestimatedAck: true })
    expect(ack.ok).toBe(true)
  })
  it('تجمع كلّ الناقص لا أوّله فقط', () => {
    expect(missingFields({ objectiveId: null, level: null, cost: null })).toEqual(['goal', 'level', 'cost'])
  })
})

describe('شارة اليتيمة مُشتقّة (أ٣)', () => {
  it('يتيمة = بلا هدف — تُشتقّ من الحقل لا نصّ مخزّن', () => {
    expect(isOrphan({ objectiveId: null })).toBe(true)
    expect(isOrphan({ objectiveId: 'obj-1' })).toBe(false)
  })
})
