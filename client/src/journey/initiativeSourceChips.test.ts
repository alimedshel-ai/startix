import { describe, expect, it } from 'vitest'

import { stageForPath } from '@/journey'
import { isStageInPath } from '@/lib/journeyStages'
import type { StrategyPath } from '@/types/user'

// ─── يقفل «الاشتقاق الكامل» لرقاقات مصادر المولّد (owner/InitiativesPage) ─────
// الخطر الذي نحرسه: نصف اشتقاق — «أيّ رقاقة تظهر» من المسار، لكن «مرحلة كل رقاقة»
// من جدول يدويّ ثانٍ في المولّد → ينشقّ عن المحرّك لاحقاً. الاشتقاق الصحيح: كلا
// الطرفين من المصدر المركزيّ (stageForPath يقرأ JOURNEY_STAGES) + isStageInPath.
// هذا الاختبار يُثبِت الطرفين: الإسناد المركزيّ + الظهور الواعي بالمسار.

const CHIP_PATHS = ['/manager/dept-deep', '/choices', '/tows', '/directions', '/three-horizons', '/ansoff']

const visible = (path: StrategyPath): string[] =>
  CHIP_PATHS.filter((to) => { const st = stageForPath(to); return !st || isStageInPath(st, path) })

describe('رقاقات مصادر المولّد — إسناد مركزيّ + ظهور واعٍ بالمسار', () => {
  it('كل رقاقة تُسنَد لمرحلتها من stageForPath المركزيّ (لا جدول ثانٍ)', () => {
    expect(stageForPath('/manager/dept-deep')).toBe('environment') // ①
    expect(stageForPath('/tows')).toBe('synthesis')                // ②
    expect(stageForPath('/choices')).toBe('directions')            // ③
    expect(stageForPath('/directions')).toBe('directions')
    expect(stageForPath('/three-horizons')).toBe('directions')
    expect(stageForPath('/ansoff')).toBe('directions')
  })

  it('QUICK يُظهر ①② فقط (يُخفي ③ — خارج مساره)', () => {
    expect(visible('QUICK')).toEqual(['/manager/dept-deep', '/tows'])
  })

  it('MEDIUM يُضيف ③ (داخل مساره)', () => {
    expect(visible('MEDIUM')).toEqual(CHIP_PATHS)
  })

  it('LONG يُظهر الكلّ', () => {
    expect(visible('LONG')).toEqual(CHIP_PATHS)
  })
})
