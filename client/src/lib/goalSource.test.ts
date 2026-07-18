import { describe, expect, it } from 'vitest'

import { goalSourceFor } from './goalSource'

describe('goalSourceFor — اشتقاق مصدر الأهداف من الدور', () => {
  it('المدير المستقل (INDEPENDENT_PRO) → manual (يؤلّف أهدافه)', () => {
    expect(goalSourceFor('MANAGER', 'INDEPENDENT_PRO')).toBe('manual')
  })

  it('المدير الداخلي (INTERNAL) → fromOwner (يتشارك أهداف المالك)', () => {
    expect(goalSourceFor('MANAGER', 'INTERNAL')).toBe('fromOwner')
  })

  it('المالك (OWNER) → null (يملك أهدافه، لا شارة)', () => {
    expect(goalSourceFor('OWNER', null)).toBeNull()
    expect(goalSourceFor('INVESTOR', null)).toBeNull()
    expect(goalSourceFor('MANAGER', null)).toBeNull()   // نوع مدير غير محدّد → لا شارة
  })
})
