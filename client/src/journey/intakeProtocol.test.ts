import { describe, expect, it } from 'vitest'

import type { ClientLevel } from './classify'
import { intakeProtocol } from './intakeProtocol'

const LEVELS: ClientLevel[] = ['assess', 'emergency', 'foundation', 'growth', 'excellence']

describe('intakeProtocol — بروتوكول الاستلام (③)', () => {
  it('كل مستوى يُنتج حالة + مخرجًا متوقَّعًا + مسار منتجات غير فارغ', () => {
    for (const level of LEVELS) {
      const p = intakeProtocol(level)
      expect(p.statusLabel.length).toBeGreaterThan(0)
      expect(p.expectedOutput.length).toBeGreaterThan(0)
      expect(p.duration.length).toBeGreaterThan(0)
      expect(p.productPath.length).toBeGreaterThan(0)
    }
  })

  it('نقطة البدء مبنيّة فعلًا للمستويات التنفيذيّة (لا نبدأ بمنتجٍ غير موجود)', () => {
    for (const level of ['assess', 'emergency', 'foundation', 'growth'] as ClientLevel[]) {
      expect(intakeProtocol(level).productPath[0].available, `${level} يبدأ بمنتج مبنيّ`).toBe(true)
    }
  })

  it('الطوارئ تبدأ بالإنقاذ؛ التقييم يبدأ بتدقيق النضج', () => {
    expect(intakeProtocol('emergency').productPath[0].label).toContain('الإنقاذ')
    expect(intakeProtocol('emergency').statusLabel).toContain('طوارئ')
    expect(intakeProtocol('assess').productPath[0].label).toContain('تدقيق النضج')
  })

  it('المنتجات غير المبنيّة مُوسَمة 🔜 (available=false) — صدقٌ لا وهم', () => {
    // التميّز مساره كلّه قادم (تقرير المالك/الموازنة/الجدوى غير مبنيّة بعد).
    expect(intakeProtocol('excellence').productPath.every((s) => !s.available)).toBe(true)
  })

  it('المحور التنظيميّ (GOV overallPct) يُنقّح لا يقلب المستوى', () => {
    // نفس المستوى، ملاحظاتٌ تنظيميّة مختلفة حسب النسبة.
    expect(intakeProtocol('growth', null).orgNote).toContain('غير مقيَّمة')
    expect(intakeProtocol('growth', 25).orgNote).toContain('ضعيفة')
    expect(intakeProtocol('growth', 55).orgNote).toContain('متوسّطة')
    expect(intakeProtocol('growth', 85).orgNote).toContain('متينة')
    // المستوى (statusLabel/المسار) لا يتغيّر بتغيّر govPct.
    expect(intakeProtocol('growth', 25).statusLabel).toBe(intakeProtocol('growth', 85).statusLabel)
    expect(intakeProtocol('growth', 25).productPath).toEqual(intakeProtocol('growth', 85).productPath)
  })
})
