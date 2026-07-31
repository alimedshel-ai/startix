import { describe, expect, it } from 'vitest'

import { hasManagerPath, managerStages } from './managerPath'

describe('managerStages — مراحل المدير المستقل الأربع', () => {
  it('مستقلّ بتخصّص → الأربع بالترتيب الثابت، مفتوحة', () => {
    const s = managerStages('INDEPENDENT_PRO', 'HR')
    expect(s.map((x) => x.key)).toEqual([
      'admin-diagnosis', 'financial-diagnosis', 'composite-analysis', 'guided-plan',
    ])
    expect(s.map((x) => x.order)).toEqual([1, 2, 3, 4])
    expect(s.every((x) => !x.locked)).toBe(true)
  })

  it('mapsTo يقابل الست StageId — عرضٌ للست لا بديل', () => {
    const s = managerStages('INDEPENDENT_PRO', 'HR')
    expect(s.map((x) => x.mapsTo)).toEqual([
      'environment', 'environment', 'synthesis', 'initiatives',
    ])
  })

  it('مستقلّ بلا تخصّص → الأربع تُرجَع لكن **مقفلة** بتلميح', () => {
    const s = managerStages('INDEPENDENT_PRO', null)
    expect(s).toHaveLength(4)
    expect(s.every((x) => x.locked)).toBe(true)
    expect(s[0].unlockHint).toContain('تخصّص')
  })

  it('مالك → [] (الطبقة خاصّة بالمستقلّ)', () => {
    expect(managerStages('OWNER')).toEqual([])
  })

  it('مدير داخليّ → [] (ليس مستقلّاً)', () => {
    expect(managerStages('INTERNAL', 'HR')).toEqual([])
  })

  it('null/غير محدَّد → []', () => {
    expect(managerStages(null)).toEqual([])
    expect(managerStages(undefined)).toEqual([])
  })
})

describe('hasManagerPath', () => {
  it('المستقلّ فقط يملك المسار الرباعيّ', () => {
    expect(hasManagerPath('INDEPENDENT_PRO')).toBe(true)
    expect(hasManagerPath('INTERNAL')).toBe(false)
    expect(hasManagerPath('OWNER')).toBe(false)
    expect(hasManagerPath(null)).toBe(false)
  })
})
