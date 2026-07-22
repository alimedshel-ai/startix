import { describe, expect, it } from 'vitest'

import { classifyClient, type ClassifyState } from './classify'

function st(over: Partial<ClassifyState> = {}): ClassifyState {
  return { hasAudit: true, healthPct: 50, dangerZone: null, ...over }
}

describe('classifyClient — يشتقّ المستوى من الحالة', () => {
  it('assess: لا تدقيق → قِس أوّلاً، بلا مسار', () => {
    const r = classifyClient(st({ hasAudit: false, healthPct: null }))
    expect(r.level).toBe('assess')
    expect(r.journeyPath).toBeNull()
  })

  it('emergency: صحّة < ٤٠ → تشغيلي', () => {
    expect(classifyClient(st({ healthPct: 25 })).level).toBe('emergency')
    expect(classifyClient(st({ healthPct: 25 })).journeyPath).toBe('QUICK')
  })

  it('emergency: RED يُجبر الطوارئ مهما كانت النسبة', () => {
    expect(classifyClient(st({ healthPct: 75, dangerZone: 'RED' })).level).toBe('emergency')
  })

  it('foundation: ٤٠-٥٩ → تشغيلي', () => {
    expect(classifyClient(st({ healthPct: 50 })).level).toBe('foundation')
    expect(classifyClient(st({ healthPct: 50 })).journeyPath).toBe('QUICK')
  })

  it('growth: ٦٠-٧٩ → تكتيكي', () => {
    expect(classifyClient(st({ healthPct: 70 })).level).toBe('growth')
    expect(classifyClient(st({ healthPct: 70 })).journeyPath).toBe('MEDIUM')
  })

  it('excellence: ≥٨٠ → استراتيجي', () => {
    expect(classifyClient(st({ healthPct: 85 })).level).toBe('excellence')
    expect(classifyClient(st({ healthPct: 85 })).journeyPath).toBe('LONG')
  })
})

describe('classifyClient — التكيّف مع التحسّن (جوهر المنهجيّة)', () => {
  it('عند العتبات: ٣٩→طوارئ · ٤٠→تأسيسي · ٦٠→نموّ · ٨٠→تميّز', () => {
    expect(classifyClient(st({ healthPct: 39 })).level).toBe('emergency')
    expect(classifyClient(st({ healthPct: 40 })).level).toBe('foundation')
    expect(classifyClient(st({ healthPct: 60 })).level).toBe('growth')
    expect(classifyClient(st({ healthPct: 80 })).level).toBe('excellence')
  })
})
