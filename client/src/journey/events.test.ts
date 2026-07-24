import { describe, expect, it } from 'vitest'

import { buildOverrideEvent } from './events'

const TS = '2026-07-24T00:00:00.000Z'

describe('buildOverrideEvent', () => {
  it('يبني حدث خروج حين تختلف الأداة عن الموصى بها', () => {
    const e = buildOverrideEvent({ tool: '/porter', recommendedTool: '/internal-environment', stage: 'environment', timestamp: TS })
    expect(e).toEqual({
      type: 'override', tool: '/porter', recommended_tool: '/internal-environment',
      stage: 'environment', timestamp: TS,
    })
  })

  it('يُرجع null إن طابقت الأداةُ الموصى بها (لا خروج)', () => {
    expect(buildOverrideEvent({ tool: '/swot', recommendedTool: '/swot', stage: 'synthesis', timestamp: TS })).toBeNull()
  })

  it('يُرجع null لأداة فارغة', () => {
    expect(buildOverrideEvent({ tool: '', recommendedTool: '/swot', stage: 'synthesis', timestamp: TS })).toBeNull()
  })
})
