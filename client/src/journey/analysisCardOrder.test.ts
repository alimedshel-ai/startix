import { describe, expect, it } from 'vitest'

import { ANALYSIS_CARD_ORDER, AUDIT_PLACEHOLDER } from './analysisCardOrder'
import { BASE_ORDER, ANALYSIS_TOOLS } from '@/lib/analysisPlan'

// حارس الترتيب (الرقعة A — ملحق): ترتيب بطاقات تحليل ① في صفحة العميل يجب أن
// يبقى مطابقاً لـ BASE_ORDER في المحرّك. يفشل عند أيّ انحراف صامت (مثال: من
// يعيد PESTEL قبل 7S). نمط الحارس التطويريّ في journey/index.ts.
describe('حارس الترتيب — بطاقات ① تطابق BASE_ORDER', () => {
  const pathToKey = new Map(Object.entries(ANALYSIS_TOOLS).map(([k, m]) => [m.path, k]))

  it('@audit أوّلاً — التدقيق الأساس دائماً', () => {
    expect(ANALYSIS_CARD_ORDER[0]).toBe(AUDIT_PLACEHOLDER)
  })

  it('كل مسار (عدا @audit) معروف في ANALYSIS_TOOLS', () => {
    const keys = ANALYSIS_CARD_ORDER.slice(1).map((p) => pathToKey.get(p))
    expect(keys.every(Boolean)).toBe(true)
  })

  it('الترتيب النسبيّ = ترتيب BASE_ORDER (لا انحراف صامت — 7S قبل PESTEL)', () => {
    const idxs = ANALYSIS_CARD_ORDER.slice(1).map((p) => BASE_ORDER.indexOf(pathToKey.get(p)!))
    expect(idxs.every((i) => i >= 0)).toBe(true)
    // مُرتَّب تصاعديّاً = يطابق تسلسل BASE_ORDER
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b))
  })
})
