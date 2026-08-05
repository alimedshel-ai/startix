import { describe, expect, it } from 'vitest'

import { deepHasContent } from './artifactContent'

describe('deepHasContent — «محفوظ» مقابل «مملوء» (محرّك قبل شاشة)', () => {
  it('فارغ صريح → false', () => {
    expect(deepHasContent(null)).toBe(false)
    expect(deepHasContent(undefined)).toBe(false)
    expect(deepHasContent({})).toBe(false)
    expect(deepHasContent([])).toBe(false)
  })

  it('null متداخل لا يرمي ويُعدّ فارغاً (حارس التعاود)', () => {
    // Object.values يمرّر null للتعاود → يجب أن يرجع false لا أن يرمي.
    expect(deepHasContent({ a: null })).toBe(false)
    expect(deepHasContent({ s: { a: null, b: '' } })).toBe(false)
    expect(deepHasContent([null, [], undefined])).toBe(false)
    expect(deepHasContent({ a: null, b: 'قيمة' })).toBe(true) // null بجانب محتوى حقيقيّ
  })

  it('مفاتيح موجودة لكن مصفوفاتها فارغة (شكل PESTEL اليتيم) → false', () => {
    expect(deepHasContent({ political: [], economic: [], social: [] })).toBe(false)
    expect(deepHasContent({ opportunities: [], threats: [] })).toBe(false)
  })

  it('نصّ فارغ/فراغات فقط لا يُعدّ محتوى', () => {
    expect(deepHasContent({ note: '' })).toBe(false)
    expect(deepHasContent({ note: '   ' })).toBe(false)
    expect(deepHasContent(['', '  '])).toBe(false)
  })

  it('أوّل عامل حقيقيّ (متداخل) → true', () => {
    expect(deepHasContent({ political: [{ text: 'ضريبة جديدة', impact: 3 }] })).toBe(true)
    expect(deepHasContent({ opportunities: [], threats: ['منافس'] })).toBe(true)
    expect(deepHasContent({ a: { b: { c: 'قيمة' } } })).toBe(true)
  })

  it('رقم يُعدّ محتوى؛ boolean لا', () => {
    expect(deepHasContent({ score: 0 })).toBe(true)
    expect(deepHasContent({ score: 42 })).toBe(true)
    expect(deepHasContent({ done: true })).toBe(false)
    expect(deepHasContent({ done: false })).toBe(false)
  })
})
