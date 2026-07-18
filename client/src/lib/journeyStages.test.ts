import { describe, expect, it } from 'vitest'

import { JOURNEY_STAGES, canOpenStage, overallProgressPct, stageLevel, type StageId } from './journeyStages'

const NONE: Record<StageId, boolean> = {
  environment: false, synthesis: false, directions: false,
  indicators: false, initiatives: false, execution: false,
}

describe('journeyStages.canOpenStage', () => {
  it('stage 1 (environment) is always open', () => {
    expect(canOpenStage('environment', NONE)).toBe(true)
  })

  it('locked stages require the previous locked stage to be complete', () => {
    // synthesis needs environment
    expect(canOpenStage('synthesis', NONE)).toBe(false)
    expect(canOpenStage('synthesis', { ...NONE, environment: true })).toBe(true)

    // directions needs synthesis
    expect(canOpenStage('directions', { ...NONE, environment: true })).toBe(false)
    expect(canOpenStage('directions', { ...NONE, environment: true, synthesis: true })).toBe(true)

    // indicators needs directions
    expect(canOpenStage('indicators', { ...NONE, environment: true, synthesis: true })).toBe(false)
    expect(canOpenStage('indicators', { ...NONE, environment: true, synthesis: true, directions: true })).toBe(true)
  })

  it('unlocked stages (initiatives/execution) require ALL locked stages complete', () => {
    // initiatives is locked=false but needs all 4 locked stages done.
    expect(canOpenStage('initiatives', NONE)).toBe(false)
    expect(canOpenStage('initiatives', {
      ...NONE, environment: true, synthesis: true, directions: true,
    })).toBe(false)
    expect(canOpenStage('initiatives', {
      ...NONE, environment: true, synthesis: true, directions: true, indicators: true,
    })).toBe(true)

    // execution follows the same rule.
    expect(canOpenStage('execution', {
      ...NONE, environment: true, synthesis: true, directions: true,
    })).toBe(false)
    expect(canOpenStage('execution', {
      ...NONE, environment: true, synthesis: true, directions: true, indicators: true,
    })).toBe(true)
  })
})

describe('journeyStages.overallProgressPct', () => {
  it('returns 0 when nothing is complete', () => {
    expect(overallProgressPct(NONE)).toBe(0)
  })

  it('returns 100 when all locked stages are complete', () => {
    expect(overallProgressPct({
      ...NONE, environment: true, synthesis: true, directions: true, indicators: true,
    })).toBe(100)
  })

  it('ignores unlocked stages when computing progress', () => {
    // Even if initiatives is marked done, it doesn't count toward progress.
    expect(overallProgressPct({
      ...NONE, initiatives: true,
    })).toBe(0)
  })

  it('rounds correctly to 25/50/75 for partial locked completion', () => {
    expect(overallProgressPct({ ...NONE, environment: true })).toBe(25)
    expect(overallProgressPct({ ...NONE, environment: true, synthesis: true })).toBe(50)
    expect(overallProgressPct({ ...NONE, environment: true, synthesis: true, directions: true })).toBe(75)
  })

  // إصلاح «الرقم الكاذب»: المقام يتبع المسار المُختار لا كل المراحل المقفلة.
  it('is path-aware — QUICK reaches 100% after its 2 in-path locked stages', () => {
    // QUICK path locked stages = environment + synthesis (directions/indicators خارج المسار).
    const quickDone = { ...NONE, environment: true, synthesis: true }
    expect(overallProgressPct(quickDone, 'QUICK')).toBe(100)   // لا يعلق تحت ١٠٠٪
    expect(overallProgressPct(quickDone, null)).toBe(50)       // بلا مسار → السلوك القديم (÷٤)
  })

  it('is path-aware — MEDIUM denominator excludes indicators', () => {
    // MEDIUM locked in-path = environment + synthesis + directions (٣).
    const mediumDone = { ...NONE, environment: true, synthesis: true, directions: true }
    expect(overallProgressPct(mediumDone, 'MEDIUM')).toBe(100)
    expect(overallProgressPct({ ...NONE, environment: true }, 'MEDIUM')).toBe(33)
  })

  it('LONG counts all 4 locked stages (same as no path)', () => {
    const done = { ...NONE, environment: true, synthesis: true }
    expect(overallProgressPct(done, 'LONG')).toBe(50)
  })
})

describe('journeyStages.stageLevel', () => {
  it('derives tool level as the minimal path containing the stage', () => {
    expect(stageLevel('environment')).toBe('QUICK')  // تشغيلي
    expect(stageLevel('synthesis')).toBe('QUICK')
    expect(stageLevel('initiatives')).toBe('QUICK')
    expect(stageLevel('execution')).toBe('QUICK')
    expect(stageLevel('directions')).toBe('MEDIUM')  // تكتيكي
    expect(stageLevel('indicators')).toBe('LONG')    // استراتيجي
  })
})

describe('JOURNEY_STAGES structure', () => {
  it('has exactly 6 stages ordered 1..6', () => {
    expect(JOURNEY_STAGES.length).toBe(6)
    expect(JOURNEY_STAGES.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('has exactly 4 locked and 2 unlocked stages', () => {
    expect(JOURNEY_STAGES.filter((s) => s.locked).length).toBe(4)
    expect(JOURNEY_STAGES.filter((s) => !s.locked).length).toBe(2)
  })

  it('every stage has non-empty toolPaths', () => {
    for (const s of JOURNEY_STAGES) {
      expect(s.toolPaths.length).toBeGreaterThan(0)
    }
  })

  it('starredPaths are always a subset of toolPaths', () => {
    for (const s of JOURNEY_STAGES) {
      for (const p of s.starredPaths) {
        expect(s.toolPaths).toContain(p)
      }
    }
  })
})
