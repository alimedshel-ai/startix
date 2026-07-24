import { describe, expect, it } from 'vitest'

import { analysisPlanFor, ANALYSIS_TOOLS, firstIncompleteAnalysisKey } from './analysisPlan'

describe('analysisPlanFor — المستوى (حجم × صحّة × قطاع)', () => {
  it('صغيرة صحّتها عاديّة → تشغيليّ (٣ أدوات موصى بها، الثقيلة مخفيّة)', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'other', healthPct: 55 })
    expect(p.tier).toBe('operational')
    expect(p.recommended).toEqual(['audit', 's7', 'pestel'])
    expect(p.advanced).toContain('porter')
    expect(p.advanced).toContain('org-dna')
    expect(p.advanced).toContain('deep')
  })

  it('متوسطة → تكتيكيّ (يضيف العميق/سلسلة القيمة/المقارنة/أصحاب المصلحة)', () => {
    const p = analysisPlanFor({ size: 'MEDIUM', sector: 'other', healthPct: 65 })
    expect(p.tier).toBe('tactical')
    expect(p.recommended).toEqual(expect.arrayContaining(['audit', 's7', 'deep', 'value-chain', 'benchmarking', 'pestel', 'stakeholders']))
    // الاستراتيجيّة تبقى متقدّمة
    expect(p.advanced).toEqual(expect.arrayContaining(['porter', 'org-dna']))
  })

  it('التحليل العميق يسبق البيئة الداخليّة 7S (7S تُبنى على العميق)', () => {
    const p = analysisPlanFor({ size: 'MEDIUM', sector: 'other', healthPct: 65 })
    expect(p.recommended.indexOf('deep')).toBeLessThan(p.recommended.indexOf('s7'))
  })

  it('كبيرة → استراتيجيّ (كل الأدوات موصى بها، لا متقدّم)', () => {
    const p = analysisPlanFor({ size: 'LARGE', sector: 'other', healthPct: 70 })
    expect(p.tier).toBe('strategic')
    expect(p.advanced).toEqual([])
    expect(p.recommended).toContain('porter')
    expect(p.recommended).toContain('org-dna')
  })

  it('الصحّة الحرجة تخفض المستوى (متوسطة + حرجة → تشغيليّ مضغوط)', () => {
    const p = analysisPlanFor({ size: 'MEDIUM', sector: 'other', healthPct: 30 })
    expect(p.tier).toBe('operational')
    expect(p.why).toContain('حرجة')
  })

  it('dangerZone=RED يعامَل كحرج حتى لو النسبة أعلى', () => {
    const p = analysisPlanFor({ size: 'MEDIUM', sector: 'other', healthPct: 65, dangerZone: 'RED' })
    expect(p.tier).toBe('operational')
  })

  it('الصحّة الممتازة ترفع المستوى (صغيرة + ٨٥٪ → تكتيكيّ)', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'other', healthPct: 85 })
    expect(p.tier).toBe('tactical')
    expect(p.why).toContain('ممتازة')
  })

  it('القطاع الكثيف يرفع المستوى (صغيرة تصنيع → تكتيكيّ)', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'manufacturing', healthPct: 55 })
    expect(p.tier).toBe('tactical')
    expect(p.why).toContain('قطاع')
  })
})

describe('analysisPlanFor — رفع القطاع = إظهار لا تقديم', () => {
  it('يُظهر أداة القطاع المخفيّة (استشارات تشغيليّ → أصحاب المصلحة يظهر)', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'consulting', healthPct: 55 })
    expect(p.tier).toBe('operational')
    expect(p.recommended).toContain('stakeholders') // رُقّي من المتقدّم
    expect(p.advanced).not.toContain('stakeholders')
  })

  it('التسلسل محفوظ: أصحاب المصلحة لا يقفز أمام الأدوات الداخليّة', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'consulting', healthPct: 55 })
    // يتبع الترتيب المرجعيّ داخل→خارج، فيبقى أخيراً لا ثانياً.
    expect(p.recommended[1]).toBe('s7')
    expect(p.recommended.indexOf('stakeholders')).toBeGreaterThan(p.recommended.indexOf('pestel'))
    expect(p.recommended[p.recommended.length - 1]).toBe('stakeholders')
  })

  it('سيناريو المستخدم: متوسطة استشارات → أصحاب المصلحة أخيراً لا ثانياً', () => {
    const p = analysisPlanFor({ size: 'MEDIUM', sector: 'consulting', healthPct: 65 })
    expect(p.recommended[1]).not.toBe('stakeholders')
    expect(p.recommended[p.recommended.length - 1]).toBe('stakeholders')
  })

  it('لا تغيير في الترتيب إن كان القطاع بلا boost (other)', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'other', healthPct: 55 })
    expect(p.recommended[1]).toBe('s7')
  })
})

describe('analysisPlanFor — سلامة المخرجات', () => {
  it('لا تكرار ولا فقدان — الموصى + المتقدّم = ٩ أدوات', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'manufacturing', healthPct: 55 })
    const all = [...p.recommended, ...p.advanced]
    expect(new Set(all).size).toBe(all.length) // لا تكرار
    expect(all.length).toBe(9)
  })

  it('حجم غير معروف/صحّة null → تشغيليّ آمن', () => {
    const p = analysisPlanFor({ size: 'MICRO' })
    expect(p.tier).toBe('operational')
    expect(p.recommended[0]).toBe('audit')
  })

  it('كل مفتاح موصى/متقدّم له بيانات وصفيّة في ANALYSIS_TOOLS', () => {
    const p = analysisPlanFor({ size: 'LARGE', sector: 'other', healthPct: 70 })
    for (const k of [...p.recommended, ...p.advanced]) {
      expect(ANALYSIS_TOOLS[k]).toBeDefined()
    }
  })
})

describe('firstIncompleteAnalysisKey — تسلسل البوصلة', () => {
  it('يُرجع أوّل أداة غير مكتملة بالترتيب', () => {
    const rec = ['audit', 's7', 'pestel']
    const done = new Set(['audit'])
    expect(firstIncompleteAnalysisKey(rec, (k) => done.has(k))).toBe('s7')
  })

  it('يقفز المكتملة (تدقيق+7S تمّا → التالي PESTEL لا 7S)', () => {
    const rec = ['audit', 's7', 'pestel']
    const done = new Set(['audit', 's7'])
    expect(firstIncompleteAnalysisKey(rec, (k) => done.has(k))).toBe('pestel')
  })

  it('اكتمل كل الموصى به → null (تنتقل البوصلة للتوليف)', () => {
    const rec = ['audit', 's7', 'pestel']
    expect(firstIncompleteAnalysisKey(rec, () => true)).toBeNull()
  })
})
