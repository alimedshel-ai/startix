import { describe, expect, it } from 'vitest'

import { layer1Complete, layer1Missing, openPackages } from './finLayerGate'

describe('finLayerGate — بوّابة ط١ + قواعد فتح ط٢ (ح٢)', () => {
  const full = {
    FINQ_CURR_LIAB: 1, FINQ_CURR_ASSET: 1, FINQ_AR: 1, FINQ_AR_COLLECTED: 1, FINQ_AR_TARGET: 1,
    FINQ_DEBT: 1, FINQ_EQUITY: 1, FINQ_NET_PROFIT: 1, FINQ_GROSS_PROFIT: 1, FND_MAT: 1,
    FND_CASH: 1, FND_HEADCOUNT: 1, FND_SAL: 1, FND_ANNUAL_REVENUE: 1,
  }

  it('ط١ مكتملة عند وجود الـ١٤ حقلًا؛ ناقصة تُبلّغ بالمفقود', () => {
    expect(layer1Complete(full)).toBe(true)
    const { FINQ_AR, FND_CASH, ...missing } = full
    expect(layer1Complete(missing)).toBe(false)
    expect(layer1Missing(missing).sort()).toEqual(['FINQ_AR', 'FND_CASH'].sort())
  })

  it('ف١ سيولة ضعيفة ← الذمم + القروض', () => {
    const r = openPackages({ instantLiquidity: 0.11 }, ['INSTANT_LIQUIDITY'])
    expect(r.fired).toContain('ف١')
    expect(r.packages.sort()).toEqual(['loans', 'receivables'])
  })

  it('ف٢ تحصيل/ذمم ← الذمم فقط', () => {
    const r = openPackages({ collectionRate: 0.6, quickRatio: 2 }, ['COLLECTION_RATE'])
    expect(r.fired).toContain('ف٢')
    expect(r.packages).toEqual(['receivables'])
  })

  it('ف٣ مديونية >1.0 ← القروض فقط', () => {
    const r = openPackages({ debtToEquity: 1.4, quickRatio: 2, collectionRate: 0.95 }, [])
    expect(r.fired).toContain('ف٣')
    expect(r.packages).toEqual(['loans'])
  })

  it('ف٤ لا شيء انطلق ← لا فتح', () => {
    const r = openPackages({ instantLiquidity: 1.2, quickRatio: 2, collectionRate: 0.96, debtToEquity: 0.5 }, [])
    expect(r.fired).toEqual(['ف٤'])
    expect(r.packages).toEqual([])
  })
})
