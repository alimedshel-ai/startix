import { describe, expect, it } from 'vitest'

import { getRescueNext, type RescueState } from './rescue'

const NONE = { risk: false, eisenhower: false, raci: false, gantt: false }
function st(over: Partial<RescueState> = {}): RescueState {
  return { criticalHealth: true, done: { ...NONE }, ...over }
}

describe('getRescueNext — التفعيل والخروج', () => {
  it('inactive: صحّة غير حرجة → المحرّك الطبيعيّ (لا إنقاذ)', () => {
    const r = getRescueNext(st({ criticalHealth: false }))
    expect(r.kind).toBe('inactive')
  })

  it('rescue-done: كل الخطوات الأربع تمّت', () => {
    const r = getRescueNext(st({ done: { risk: true, eisenhower: true, raci: true, gantt: true } }))
    expect(r.kind).toBe('rescue-done')
    expect(r.doneCount).toBe(4)
    expect(r.step).toBeUndefined()
  })
})

describe('getRescueNext — التسلسل الخطّي', () => {
  it('لا شيء مكتمل → يبدأ بخريطة المخاطر', () => {
    const r = getRescueNext(st())
    expect(r.kind).toBe('rescue')
    expect(r.step?.id).toBe('risk')
    expect(r.step?.toolPath).toBe('/risk-map')
  })

  it('المخاطر تمّت → التالي أيزنهاور', () => {
    const r = getRescueNext(st({ done: { ...NONE, risk: true } }))
    expect(r.step?.id).toBe('eisenhower')
    expect(r.doneCount).toBe(1)
  })

  it('المخاطر + أيزنهاور + RACI → التالي جانت', () => {
    const r = getRescueNext(st({ done: { risk: true, eisenhower: true, raci: true, gantt: false } }))
    expect(r.step?.id).toBe('gantt')
  })

  it('يفرض الترتيب: جانت مكتمل لكن المخاطر لا → التالي المخاطر (لا جانت)', () => {
    const r = getRescueNext(st({ done: { ...NONE, gantt: true } }))
    expect(r.step?.id).toBe('risk')
    expect(r.doneCount).toBe(1)
  })
})
