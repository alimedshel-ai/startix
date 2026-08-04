import { describe, expect, it } from 'vitest'

import { JOURNEY_STAGES } from './journeyStages'
import { shadowStageDivergence } from './journeyShadow'

// مرحلةٌ لها عدّة أدوات إكمال — نختار واحدةً منها لاختبار الانشقاق واقعيّاً.
const ogsmStage = JOURNEY_STAGES.find((s) => s.completionArtifacts.includes('OGSM'))!

describe('journeyShadow — انشقاق D1 (الوجود مقابل المحتوى)', () => {
  it('§٦-١ انشقاق الفارغة: أداة موجودة {} ⇒ الوجود مكتمل · المحتوى غير مكتمل', () => {
    const existence = new Set(['OGSM'])   // OGSM موجودةٌ (النوع حاضر)
    const content = new Set<string>()     // لكنّها فارغة — لا محتوى
    const div = shadowStageDivergence(existence, content)
    expect(div.map((d) => d.stageId)).toContain(ogsmStage.id)
    const row = div.find((d) => d.stageId === ogsmStage.id)!
    expect(row.matchedByExistence).toContain('OGSM')
  })

  it('§٦-٢ أداة ذات محتوى ⇒ لا انشقاق (الوجود = المحتوى)', () => {
    const existence = new Set(['OGSM'])
    const content = new Set(['OGSM'])     // موجودةٌ وممتلئة
    const div = shadowStageDivergence(existence, content)
    expect(div.map((d) => d.stageId)).not.toContain(ogsmStage.id)
  })

  it('كل الأدوات ممتلئة ⇒ صفر انشقاق (القائمة فارغة صادقة)', () => {
    const all = new Set(JOURNEY_STAGES.flatMap((s) => s.completionArtifacts))
    expect(shadowStageDivergence(all, all)).toEqual([])
  })

  it('لا شيء مُدخَل ⇒ صفر انشقاق (لا وجود أصلاً — ليس انحرافاً)', () => {
    expect(shadowStageDivergence(new Set(), new Set())).toEqual([])
  })
})
