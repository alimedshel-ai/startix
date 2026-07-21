import { describe, expect, it } from 'vitest'

import { getNextStep, type NextStepState } from './nextStep'
import type { StageId } from '@/lib/journeyStages'

const NONE: Record<StageId, boolean> = {
  environment: false, synthesis: false, directions: false,
  indicators: false, initiatives: false, execution: false,
}
function base(over: Partial<NextStepState> = {}): NextStepState {
  return { isPro: true, activeCompanyId: 'c1', completions: { ...NONE }, path: 'LONG', specialty: 'FINANCE', ...over }
}

describe('getNextStep — الحالات الصريحة (النقطة ٢)', () => {
  it('no-client: مدير مستقل بلا عميل', () => {
    expect(getNextStep(base({ activeCompanyId: null })).kind).toBe('no-client')
  })

  it('done: كل مراحل المسار مكتملة', () => {
    const all = { ...NONE, environment: true, synthesis: true, directions: true, indicators: true, initiatives: true, execution: true }
    const r = getNextStep(base({ completions: all }))
    expect(r.kind).toBe('done')
    expect(r.toolPath).toBe('/execute')
  })

  it('يلتقط أوّل ناقصة حتى لو اكتملت لاحقة (اكتمال غير متسلسل)', () => {
    // environment ناقص لكن directions «مكتمل» (قفز بالرابط) → التالي = environment.
    const c = { ...NONE, directions: true }
    const r = getNextStep(base({ completions: c }))
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment')
  })
})

describe('getNextStep — حالة-مدفوع + وعي المسار (النقطة ١)', () => {
  it('يبدأ بالتشخيص حين لا شيء مكتمل', () => {
    const r = getNextStep(base())
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment')
  })

  it('QUICK يتجاوز التوجّهات/المؤشّرات → بعد التوليف يقفز للمبادرات', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const r = getNextStep(base({ path: 'QUICK', completions: c }))
    expect(r.stageId).toBe('initiatives') // ليس directions
    expect(r.toolPath).toBe('/priority')
  })

  it('LONG يمرّ بكل المراحل بالترتيب', () => {
    const c = { ...NONE, environment: true, synthesis: true, directions: true }
    expect(getNextStep(base({ path: 'LONG', completions: c })).stageId).toBe('indicators')
  })
})

describe('getNextStep — بوّابة الأداة + منع الطريق المسدود', () => {
  it('التوليف بلا مصدر جاهز → يوجّه للمصدر لا لـ SWOT', () => {
    const c = { ...NONE, environment: true } // التالي synthesis
    const r = getNextStep(base({ completions: c, signals: { swotSourcesReady: false } }))
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment') // رجّعنا للمصدر
    expect(r.toolPath).not.toBe('/swot')
  })

  it('التوليف مع مصدر جاهز → يذهب لـ SWOT', () => {
    const c = { ...NONE, environment: true }
    const r = getNextStep(base({ completions: c, signals: { swotSourcesReady: true } }))
    expect(r.stageId).toBe('synthesis')
    expect(r.toolPath).toBe('/swot')
  })
})

describe('getNextStep — «لماذا» واعٍ بالبيانات (النقطة ٣)', () => {
  it('يذكر عدد الجوانب الضعيفة في سبب المبادرات', () => {
    const c = { ...NONE, environment: true, synthesis: true, directions: true, indicators: true }
    const r = getNextStep(base({ path: 'LONG', completions: c, signals: { maturityWeakCount: 3 } }))
    expect(r.stageId).toBe('initiatives')
    expect(r.reason).toContain('3')
  })

  it('تخصّص النضج: التشخيص يبدأ من deep-analysis وسببه يذكر النضج', () => {
    const r = getNextStep(base({ signals: { usesDiagnostic: true } }))
    expect(r.toolPath).toBe('/manager/deep-analysis')
    expect(r.reason).toContain('نضج')
  })
})
