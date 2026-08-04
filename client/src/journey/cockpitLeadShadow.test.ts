import { describe, expect, it } from 'vitest'

import type { StageId } from '@/lib/journeyStages'

import { getNextStep, type NextStepState } from './nextStep'

// ─── ظلّ D2 — افتراق مقرِّرَي «الخطوة القائدة» في القمرة (§٣/§٥) ───────────────
// القمرة عند USE_JOURNEY_NEXT=OFF تقود بـ useJourney.nextStage = «أوّل خطوة غير
// مكتملة بترتيب المسار» (بلا بوّابة محتوى، useJourney.ts:76-81). المحرّك getNextStep
// واعٍ ببوّابة SWOT. نُحاكي مقرِّر OFF بدالّةٍ نقيّة صغيرة ونُظهر افتراقهما على Sₑ.

const ALL: StageId[] = ['environment', 'synthesis', 'directions', 'indicators', 'initiatives', 'execution']
const comp = (done: Partial<Record<StageId, boolean>> = {}): Record<StageId, boolean> =>
  Object.fromEntries(ALL.map((id) => [id, Boolean(done[id])])) as Record<StageId, boolean>

// محاكاة useJourney.nextStage: أوّل مرحلةٍ غير مكتملة بالترتيب — بلا وعيٍ بالمحتوى.
function naiveLead(completions: Record<StageId, boolean>): StageId | null {
  return ALL.find((id) => !completions[id]) ?? null
}

describe('ظلّ D2 — القمرة (OFF) مقابل المحرّك على Sₑ', () => {
  // Sₑ: البيئة مكتملة، التوليف لا، والمصدر الخارجيّ حاضرٌ فارغ (externalSourceReady=false).
  const sE: NextStepState = {
    isPro: true, activeCompanyId: 'c1', completions: comp({ environment: true }), path: 'LONG', specialty: 'HR',
    signals: { swotSourcesReady: true, externalSourceReady: false, usesDiagnostic: true },
  }

  it('§٦-١ المقرِّران يفترقان: المحرّك يوجّه لمصدرٍ خارجيّ · العَيّ يقفز للتوليف', () => {
    const engine = getNextStep(sE)                 // المحرّك (واعٍ بالمحتوى)
    const naive = naiveLead(sE.completions)         // مقرِّر OFF (أوّل غير مكتمل)
    expect(engine.stageId).toBe('environment')      // يرجع لمصدرٍ خارجيّ (PESTEL)
    expect(engine.toolPath).toContain('pestel')
    expect(naive).toBe('synthesis')                 // يقفز للتوليف بلا بوّابة
    expect(engine.stageId).not.toBe(naive)          // ⇒ افتراقٌ مُثبَت
  })

  it('حالة سليمة (كل المصادر جاهزة): لا افتراق — كلاهما يقود للتوليف', () => {
    const ok: NextStepState = { ...sE, signals: { swotSourcesReady: true, externalSourceReady: true, usesDiagnostic: true } }
    expect(getNextStep(ok).stageId).toBe(naiveLead(ok.completions)) // synthesis = synthesis
  })
})
