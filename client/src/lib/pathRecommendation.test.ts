import { describe, expect, it } from 'vitest'

import { recommendPathFromFinancials } from './pathRecommendation'

describe('recommendPathFromFinancials — الأضعف يقيّد (نفس فلسفة الفيتو)', () => {
  it('سيولة حرجة تفرض التشغيليّ مهما نضج التتبّع', () => {
    const r = recommendPathFromFinancials({ liquidity: 'critical', financialTracking: 'perfect' })
    expect(r?.path).toBe('QUICK')
    expect(r?.binding).toBe('liquidity')
    expect(r?.reasonAr).toContain('حرجة')
  })

  it('غياب التتبّع يمنع المسار الطويل مهما ارتفعت السيولة', () => {
    const r = recommendPathFromFinancials({ liquidity: 'high', financialTracking: 'none' })
    expect(r?.path).toBe('QUICK')
    expect(r?.binding).toBe('tracking')
  })

  it('وضعٌ متوسّط → تكتيكيّ', () => {
    expect(recommendPathFromFinancials({ liquidity: 'mid', financialTracking: 'good' })?.path).toBe('MEDIUM')
  })

  it('سيولة مرتفعة + تتبّع ناضج → استراتيجيّ طويل', () => {
    const r = recommendPathFromFinancials({ liquidity: 'high', financialTracking: 'perfect' })
    expect(r?.path).toBe('LONG')
  })

  it('التعادل في الطبقة → السيولة هي المقيِّدة (الأولى بالأثر)', () => {
    const r = recommendPathFromFinancials({ liquidity: 'mid', financialTracking: 'manual' })
    // liq mid=1, track manual=1 → تعادل → binding=liquidity، والمسار تكتيكيّ.
    expect(r?.path).toBe('MEDIUM')
    expect(r?.binding).toBe('liquidity')
  })

  it('إشارةٌ واحدةٌ فقط تكفي', () => {
    expect(recommendPathFromFinancials({ financialTracking: 'none' })?.path).toBe('QUICK')
    expect(recommendPathFromFinancials({ liquidity: 'high' })?.path).toBe('LONG')
  })

  it('لا إشارة إطلاقاً → لا توصية (null)', () => {
    expect(recommendPathFromFinancials({})).toBeNull()
    expect(recommendPathFromFinancials({ liquidity: null, financialTracking: null })).toBeNull()
  })
})
