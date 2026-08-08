import { describe, expect, it } from 'vitest'

import { buildGapBridge } from './finGapBridge'

const find = (gaps: ReturnType<typeof buildGapBridge>, src: string) => gaps.find((g) => g.source === src)

describe('finGapBridge — جسر الفجوة ← الخطة (ح٧، ورقة ٩)', () => {
  it('الفيتوهات ← قصوى/عالية بأفقها', () => {
    const g = buildGapBridge({ kpis: { instantLiquidity: 0.11, collectionRate: 0.6 }, vetoes: ['INSTANT_LIQUIDITY', 'COLLECTION_RATE', 'RECEIVABLES'] })
    expect(find(g, 'فيتو السيولة')).toMatchObject({ severity: 'extreme', horizon: '90day' })
    expect(find(g, 'فيتو التحصيل')).toMatchObject({ severity: 'extreme', horizon: '90day' })
    expect(find(g, 'ضغط الذمم')).toMatchObject({ severity: 'high', horizon: 'quarterly' })
  })

  it('الملاءة >١ ← عالية ربعي', () => {
    expect(find(buildGapBridge({ kpis: { debtToEquity: 1.4 } }), 'الملاءة'))
      .toMatchObject({ severity: 'high', horizon: 'quarterly' })
  })

  it('عبء خدمة الدين: عتبة ٥٠٪ المعتمدة', () => {
    expect(find(buildGapBridge({ monthlyInstallments: 60, monthlyNetProfit: 100 }), 'عبء خدمة الدين'))
      .toMatchObject({ severity: 'high', horizon: '90day' })            // 60٪ > 50٪
    expect(find(buildGapBridge({ monthlyInstallments: 40, monthlyNetProfit: 100 }), 'عبء خدمة الدين'))
      .toBeUndefined()                                                   // 40٪ ≤ 50٪
  })

  it('المتأخر: عتبة ٣٥٪ المعتمدة (B3+B4)', () => {
    expect(find(buildGapBridge({ overdueRatio: 0.4 }), 'المتأخر فوق ٦٠ يومًا')).toBeDefined()   // 40٪ > 35٪
    expect(find(buildGapBridge({ overdueRatio: 0.3 }), 'المتأخر فوق ٦٠ يومًا')).toBeUndefined() // 30٪ ≤ 35٪
  })

  it('الحوكمة: المفصّلة صريحة، «لا» أخرى جماعيّة، «جزئياً» سنويّ، «نعم» لا فجوة', () => {
    const g = buildGapBridge({ governance: { t5_2: 'no', t3_1: 'no', t1_1: 'partial', t2_3: 'yes' } })
    expect(find(g, 't5_2')).toMatchObject({ severity: 'high', horizon: '90day' })       // مفصّل
    expect(find(g, 't3_1')).toMatchObject({ severity: 'medium', horizon: 'quarterly' }) // جماعيّ
    expect(find(g, 't1_1')).toMatchObject({ severity: 'medium', horizon: 'annual' })    // جزئياً
    expect(find(g, 't2_3')).toBeUndefined()                                             // نعم
  })

  it('لا إشارات ⇒ لا فجوات', () => {
    expect(buildGapBridge({ kpis: { instantLiquidity: 1.2, debtToEquity: 0.5 } })).toEqual([])
  })
})
