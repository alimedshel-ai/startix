import { describe, expect, it } from 'vitest'

import { managerStages } from './managerPath'
import { STAGE_TASKS, tasksForStage, type StageTaskState } from './stageTasks'

const NONE: StageTaskState = {
  hasSpecialty: false, hasAudit: false, hasMaturity: false, hasQuant: false, hasSwotSources: false,
}
const ALL: StageTaskState = {
  hasSpecialty: true, hasAudit: true, hasMaturity: true, hasQuant: true, hasSwotSources: true,
}

describe('STAGE_TASKS — يغطّي المراحل الأربع', () => {
  it('كل مفاتيح مراحل المستقلّ لها صفّ في الجدول', () => {
    const keys = managerStages('INDEPENDENT_PRO', 'HR').map((s) => s.key)
    for (const k of keys) expect(STAGE_TASKS[k]).toBeDefined()
    expect(Object.keys(STAGE_TASKS)).toHaveLength(4)
  })

  it('الإداريّ يحمل التسلسل: تدقيق ← نضج ← كمّي', () => {
    expect(STAGE_TASKS['admin-diagnosis'].map((t) => t.id)).toEqual([
      'dept-audit', 'maturity', 'quant-indicators',
    ])
  })

  it('المالي مرحلة استهلاك — قائمة فارغة موثَّقة', () => {
    expect(STAGE_TASKS['financial-diagnosis']).toEqual([])
    expect(tasksForStage('financial-diagnosis', ALL)).toEqual([])
  })
})

describe('tasksForStage — التسلسل المتدرّج داخل الإداريّ', () => {
  it('بلا تخصّص → الثلاثة مقفلة، التدقيق ناقصه hasSpecialty', () => {
    const t = tasksForStage('admin-diagnosis', NONE)
    expect(t.every((x) => x.locked)).toBe(true)
    expect(t.find((x) => x.id === 'dept-audit')!.missing).toContain('hasSpecialty')
  })

  it('بتخصّص فقط → التدقيق يُفتح، النضج مقفل (ناقصه hasAudit)، الكمّي مقفل', () => {
    const t = tasksForStage('admin-diagnosis', { ...NONE, hasSpecialty: true })
    const by = (id: string) => t.find((x) => x.id === id)!
    expect(by('dept-audit').locked).toBe(false)
    expect(by('maturity').locked).toBe(true)
    expect(by('maturity').missing).toContain('hasAudit')
    expect(by('quant-indicators').locked).toBe(true)
  })

  it('تخصّص + تدقيق → النضج يُفتح، الكمّي ما زال مقفلاً (ناقصه hasMaturity)', () => {
    const t = tasksForStage('admin-diagnosis', { ...NONE, hasSpecialty: true, hasAudit: true })
    const by = (id: string) => t.find((x) => x.id === id)!
    expect(by('maturity').locked).toBe(false)
    expect(by('quant-indicators').locked).toBe(true)
    expect(by('quant-indicators').missing).toContain('hasMaturity')
  })

  it('تخصّص + تدقيق + نضج → الكمّي يُفتح (كامل التسلسل)', () => {
    const t = tasksForStage('admin-diagnosis', { ...NONE, hasSpecialty: true, hasAudit: true, hasMaturity: true })
    expect(t.find((x) => x.id === 'quant-indicators')!.locked).toBe(false)
  })

  it('التوليف مقفل حتى تجهز مصادره', () => {
    expect(tasksForStage('composite-analysis', NONE)[0].locked).toBe(true)
    expect(tasksForStage('composite-analysis', { ...NONE, hasSwotSources: true })[0].missing).toEqual([])
  })

  it('الخطة الموجّهة مقفلة حتى تُدخَل المؤشرات الكمّية', () => {
    expect(tasksForStage('guided-plan', NONE)[0].locked).toBe(true)
    expect(tasksForStage('guided-plan', { ...NONE, hasQuant: true })[0].locked).toBe(false)
  })

  it('كل شيء جاهز → لا مهمّة مقفلة عبر المراحل الأربع', () => {
    const all = (['admin-diagnosis', 'financial-diagnosis', 'composite-analysis', 'guided-plan'] as const)
      .flatMap((s) => tasksForStage(s, ALL))
    expect(all.every((x) => !x.locked)).toBe(true)
  })
})

describe('القاعدة الدائمة — لا حقل State ميّت (كلٌّ تشترطه مهمّة)', () => {
  it('كل حقل في StageTaskState تشترطه مهمّة واحدة على الأقل', () => {
    const required = new Set(Object.values(STAGE_TASKS).flat().flatMap((t) => t.requires))
    for (const key of Object.keys(ALL) as (keyof StageTaskState)[]) {
      expect(required.has(key)).toBe(true) // فشلٌ هنا = حقل State ميّت (مثل hasAudit قبل بأ٣)
    }
  })
})
