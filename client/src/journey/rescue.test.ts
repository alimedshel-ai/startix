import { describe, expect, it } from 'vitest'

import {
  getRescueNext, type RescueState,
  resolveRescuePlan, pickWeakestAxis, type RescuePlanState,
} from './rescue'

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

// ─── النموذج الجديد (الموجة ١) ───────────────────────────────────────
const P0 = { axisPicked: false, actionRecorded: false, initiativeCreated: false }
function ps(over: Partial<RescuePlanState> = {}): RescuePlanState {
  return { criticalHealth: true, healthPct: 30, progress: { ...P0 }, ...over }
}

describe('resolveRescuePlan — التسلسل الدلاليّ الجديد', () => {
  it('inactive: صحّة غير حرجة (أو لا تدقيق) → لا إنقاذ', () => {
    expect(resolveRescuePlan(ps({ criticalHealth: false })).kind).toBe('inactive')
  })

  it('يبدأ بتحديد المحور الأضعف', () => {
    const r = resolveRescuePlan(ps())
    expect(r.kind).toBe('active')
    expect(r.step?.id).toBe('axis')
    expect(r.step?.n).toBe(1)
  })

  it('بعد المحور → إجراء تصحيحيّ', () => {
    const r = resolveRescuePlan(ps({ progress: { ...P0, axisPicked: true } }))
    expect(r.step?.id).toBe('action')
  })

  it('بعد المحور+الإجراء → مبادرة عاجلة', () => {
    const r = resolveRescuePlan(ps({ progress: { axisPicked: true, actionRecorded: true, initiativeCreated: false } }))
    expect(r.step?.id).toBe('initiative')
  })

  it('منع الحلقة بنيويّاً: إعادة التدقيق لا تُبلَغ إلا بعد ٢و٣', () => {
    // إجراء بلا مبادرة → لا تزال على المبادرة، لا إعادة التدقيق.
    const partial = resolveRescuePlan(ps({ progress: { axisPicked: true, actionRecorded: true, initiativeCreated: false } }))
    expect(partial.atReaudit).toBe(false)
    expect(partial.step?.id).not.toBe('reaudit')
    // ٢و٣ تمّتا → الآن فقط إعادة التدقيق.
    const full = resolveRescuePlan(ps({ progress: { axisPicked: true, actionRecorded: true, initiativeCreated: true } }))
    expect(full.step?.id).toBe('reaudit')
    expect(full.atReaudit).toBe(true)
  })

  it('الخروج بالصحّة لا بالخطوات: كل الخطوات تمّت لكن الصحّة تعافت → inactive', () => {
    const r = resolveRescuePlan(ps({ criticalHealth: false, healthPct: 46, progress: { axisPicked: true, actionRecorded: true, initiativeCreated: true } }))
    expect(r.kind).toBe('inactive')
  })
})

describe('pickWeakestAxis', () => {
  it('يُرجع المحور الأدنى', () => {
    expect(pickWeakestAxis({ governance: 60, financial: 40, team: 25, digital: 55 })).toBe('team')
  })
  it('تعادل → أوّل محور بالترتيب (الحوكمة)', () => {
    expect(pickWeakestAxis({ governance: 20, financial: 20, team: 80, digital: 80 })).toBe('governance')
  })
})
