import { describe, expect, it } from 'vitest'

import { isToolVisible, visibleTools } from './goalGating'

describe('goalGating.visibleTools', () => {
  it('returns null (no filter) for empty goals', () => {
    expect(visibleTools([])).toBeNull()
    expect(visibleTools(null)).toBeNull()
    expect(visibleTools(undefined)).toBeNull()
  })

  it('returns the tool set of a single goal', () => {
    const set = visibleTools(['swot'])!
    expect(set).not.toBeNull()
    expect(set.has('/swot')).toBe(true)
    expect(set.has('/tows')).toBe(true)
    // swot goal does not surface KPIs.
    expect(set.has('/kpis')).toBe(false)
  })

  it('unions multiple goals', () => {
    const set = visibleTools(['swot', 'kpis'])!
    expect(set.has('/swot')).toBe(true)
    expect(set.has('/kpis')).toBe(true)
    expect(set.has('/tows')).toBe(true) // من swot
  })

  it('ignores unknown goal codes gracefully', () => {
    const set = visibleTools(['not_a_goal'])!
    expect(set.size).toBe(0)
  })
})

describe('goalGating.isToolVisible', () => {
  it('always visible when no filter (null set)', () => {
    expect(isToolVisible('/swot', null)).toBe(true)
    expect(isToolVisible('/kpis', null)).toBe(true)
  })

  it('allows ungated paths through even when filter is active', () => {
    const set = visibleTools(['swot'])!
    // /admin-dashboard is not in GOAL_TO_TOOLS at all — it must remain visible.
    expect(isToolVisible('/admin-dashboard', set)).toBe(true)
    expect(isToolVisible('/manager/clients', set)).toBe(true)
  })

  it('hides gated paths not in the visible set', () => {
    const set = visibleTools(['swot'])!
    expect(isToolVisible('/swot', set)).toBe(true)
    expect(isToolVisible('/kpis', set)).toBe(false)
    expect(isToolVisible('/ansoff', set)).toBe(false)
  })
})
