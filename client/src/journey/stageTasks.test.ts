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
})

describe('tasksForStage — القفل مشتقّ من الحالة', () => {
  it('تشخيص إداريّ بلا تخصّص → مهامه مقفلة، الناقص hasSpecialty', () => {
    const t = tasksForStage('admin-diagnosis', NONE)
    expect(t.map((x) => x.id)).toEqual(['dept-audit', 'maturity'])
    expect(t.every((x) => x.locked)).toBe(true)
    expect(t[0].missing).toContain('hasSpecialty')
  })

  it('تشخيص إداريّ بتخصّص → مفتوح', () => {
    const t = tasksForStage('admin-diagnosis', { ...NONE, hasSpecialty: true })
    expect(t.every((x) => !x.locked)).toBe(true)
  })

  it('التحليل الكمّي مقفل حتى يكتمل النضج', () => {
    expect(tasksForStage('financial-diagnosis', NONE)[0].locked).toBe(true)
    expect(tasksForStage('financial-diagnosis', { ...NONE, hasMaturity: true })[0].locked).toBe(false)
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
