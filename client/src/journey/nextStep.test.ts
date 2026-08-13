import { describe, expect, it } from 'vitest'

import { getNextStep, type NextStepState } from './nextStep'
import type { StageId } from '@/lib/journeyStages'

const NONE: Record<StageId, boolean> = {
  environment: false, synthesis: false, directions: false,
  indicators: false, initiatives: false, execution: false,
}
function base(over: Partial<NextStepState> = {}): NextStepState {
  return { isPro: true, activeCompanyId: 'c1', completions: { ...NONE }, path: 'LONG', specialty: 'FINANCE', ...over }
}

describe('getNextStep — الحالات الصريحة (النقطة ٢)', () => {
  it('no-client: مدير مستقل بلا عميل', () => {
    expect(getNextStep(base({ activeCompanyId: null })).kind).toBe('no-client')
  })

  it('done: كل مراحل المسار مكتملة', () => {
    const all = { ...NONE, environment: true, synthesis: true, directions: true, indicators: true, initiatives: true, execution: true }
    const r = getNextStep(base({ completions: all }))
    expect(r.kind).toBe('done')
    expect(r.toolPath).toBe('/execute')
  })

  it('يلتقط أوّل ناقصة حتى لو اكتملت لاحقة (اكتمال غير متسلسل)', () => {
    // environment ناقص لكن directions «مكتمل» (قفز بالرابط) → التالي = environment.
    const c = { ...NONE, directions: true }
    const r = getNextStep(base({ completions: c }))
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment')
  })
})

describe('getNextStep — حالة-مدفوع + وعي المسار (النقطة ١)', () => {
  it('يبدأ بالتشخيص حين لا شيء مكتمل', () => {
    const r = getNextStep(base())
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment')
  })

  it('QUICK يتجاوز التوجّهات/المؤشّرات → بعد التوليف يقفز للمبادرات', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const r = getNextStep(base({ path: 'QUICK', completions: c }))
    expect(r.stageId).toBe('initiatives') // ليس directions
    expect(r.toolPath).toBe('/priority')
  })

  it('LONG يمرّ بكل المراحل بالترتيب', () => {
    const c = { ...NONE, environment: true, synthesis: true, directions: true }
    expect(getNextStep(base({ path: 'LONG', completions: c })).stageId).toBe('indicators')
  })
})

describe('getNextStep — بوّابة الأداة + منع الطريق المسدود', () => {
  it('التوليف بلا مصدر جاهز → يوجّه للمصدر لا لـ SWOT', () => {
    const c = { ...NONE, environment: true } // التالي synthesis
    const r = getNextStep(base({ completions: c, signals: { swotSourcesReady: false } }))
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment') // رجّعنا للمصدر
    expect(r.toolPath).not.toBe('/swot')
  })

  it('التوليف مع مصدر جاهز → يذهب لـ SWOT', () => {
    const c = { ...NONE, environment: true }
    const r = getNextStep(base({ completions: c, signals: { swotSourcesReady: true } }))
    expect(r.stageId).toBe('synthesis')
    expect(r.toolPath).toBe('/swot')
  })

  it('داخليّ جاهز لكن لا مسح خارجيّ → يوجّه لـ PESTEL لا لـ SWOT (فرص/تهديدات فارغة)', () => {
    const c = { ...NONE, environment: true } // التالي synthesis
    const r = getNextStep(base({ completions: c, signals: { swotSourcesReady: true, externalSourceReady: false } }))
    expect(r.kind).toBe('action')
    expect(r.stageId).toBe('environment')
    expect(r.toolPath).toBe('/manager/dept-pestel') // isPro=true
    expect(r.reason).toContain('خارجيّ')
    expect(r.toolPath).not.toBe('/swot')
  })

  it('الشقّان جاهزان (داخليّ + خارجيّ) → يذهب لـ SWOT', () => {
    const c = { ...NONE, environment: true }
    const r = getNextStep(base({ completions: c, signals: { swotSourcesReady: true, externalSourceReady: true } }))
    expect(r.stageId).toBe('synthesis')
    expect(r.toolPath).toBe('/swot')
  })

  it('غير المدير المستقل: المسح الخارجيّ يوجّه لـ /pestel', () => {
    const c = { ...NONE, environment: true }
    const r = getNextStep(base({ isPro: false, completions: c, signals: { swotSourcesReady: true, externalSourceReady: false } }))
    expect(r.toolPath).toBe('/pestel')
  })
})

describe('getNextStep — إشارة التوطين تُثري سبب المبادرات (تكامل ④)', () => {
  // QUICK: بعد environment+synthesis التالي = initiatives.
  const c = { ...NONE, environment: true, synthesis: true }

  it('توطين غير ممتثل بفجوة → السبب يرفعها كأولوية امتثال', () => {
    const r = getNextStep(base({ path: 'QUICK', completions: c, signals: { saudizationStatus: 'non_compliant', saudizationGap: 3 } }))
    expect(r.stageId).toBe('initiatives')
    expect(r.reason).toContain('توطين')
    expect(r.reason).toContain('3')
  })

  it('يدمج فجوة التوطين مع جوانب النضج الضعيفة إن وُجدت', () => {
    const r = getNextStep(base({ path: 'QUICK', completions: c, signals: { saudizationStatus: 'non_compliant', saudizationGap: 2, maturityWeakCount: 4 } }))
    expect(r.reason).toContain('توطين')
    expect(r.reason).toContain('4')
  })

  it('توطين ممتثل → لا يطغى على السبب الافتراضيّ', () => {
    const r = getNextStep(base({ path: 'QUICK', completions: c, signals: { saudizationStatus: 'compliant', saudizationGap: 0 } }))
    expect(r.reason).not.toContain('توطين')
  })
})

describe('getNextStep — العمق يفلتر العرض لا الاكتمال (ثبات الاكتمال)', () => {
  it('نفس الاكتمال: مرحلة مكتملة لا تُعاد كـ«تالية» مهما اختلف العمق (QUICK vs LONG)', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const sig = { swotSourcesReady: true, externalSourceReady: true }
    const quick = getNextStep(base({ path: 'QUICK', completions: c, signals: sig }))
    const long = getNextStep(base({ path: 'LONG', completions: c, signals: sig }))
    // العمق يغيّر الوجهة: QUICK يقفز للمبادرات، LONG يمرّ بالتوجّهات…
    expect(quick.stageId).toBe('initiatives')
    expect(long.stageId).toBe('directions')
    // …لكن لا يُعيد أيّ مرحلة مكتملة (environment/synthesis) كخطوة تالية في أيّهما.
    for (const r of [quick, long]) {
      expect(r.stageId).not.toBe('environment')
      expect(r.stageId).not.toBe('synthesis')
    }
  })

  it('اكتمال كل المراحل → done لكلا العمقين (الاكتمال مسار-محايد)', () => {
    const all = { ...NONE, environment: true, synthesis: true, directions: true, indicators: true, initiatives: true, execution: true }
    expect(getNextStep(base({ path: 'QUICK', completions: all })).kind).toBe('done')
    expect(getNextStep(base({ path: 'LONG', completions: all })).kind).toBe('done')
  })
})

describe('getNextStep — «لماذا» واعٍ بالبيانات (النقطة ٣)', () => {
  it('يذكر عدد الجوانب الضعيفة في سبب المبادرات', () => {
    const c = { ...NONE, environment: true, synthesis: true, directions: true, indicators: true }
    const r = getNextStep(base({ path: 'LONG', completions: c, signals: { maturityWeakCount: 3 } }))
    expect(r.stageId).toBe('initiatives')
    expect(r.reason).toContain('3')
  })

  it('تخصّص النضج: التشخيص يبدأ من deep-analysis وسببه يذكر النضج', () => {
    const r = getNextStep(base({ signals: { usesDiagnostic: true } }))
    expect(r.toolPath).toBe('/manager/deep-analysis')
    expect(r.reason).toContain('نضج')
  })
})

describe('getNextStep — توصية TOWS الناعمة (قرار المالك، بعد SWOT)', () => {
  it('توليف مكتمل + TOWS غير معمولة (MEDIUM) → يقترح TOWS قبل التوجّهات (لا يلزم) + قابل للتخطّي', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const r = getNextStep(base({ path: 'MEDIUM', completions: c, signals: { hasTows: false } }))
    expect(r.toolPath).toBe('/tows')
    expect(r.reason).toContain('اختياريّة')
    expect(r.skippable).toBe(true)
    expect(r.skipTo).toBe('/directions') // وجهة التخطّي = الخطوة الحقيقيّة التالية
  })

  it('تخطّى TOWS (towsSkipped) → يُكتَم الاقتراح ويمضي للتوجّهات', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const r = getNextStep(base({ path: 'MEDIUM', completions: c, signals: { hasTows: false, towsSkipped: true } }))
    expect(r.stageId).toBe('directions')
    expect(r.toolPath).not.toBe('/tows')
    expect(r.skippable).toBeFalsy()
  })

  it('TOWS معمولة → لا اقتراح، يمضي للتوجّهات', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const r = getNextStep(base({ path: 'MEDIUM', completions: c, signals: { hasTows: true } }))
    expect(r.stageId).toBe('directions')
    expect(r.toolPath).not.toBe('/tows')
  })

  it('لا تعلق: تخطّى TOWS وأكمل التوجّهات → لا يعود يقترح TOWS', () => {
    const c = { ...NONE, environment: true, synthesis: true, directions: true }
    const r = getNextStep(base({ path: 'MEDIUM', completions: c, signals: { hasTows: false } }))
    expect(r.toolPath).not.toBe('/tows') // تجاوز الحدّ ②→③ فاختفت التوصية
    expect(r.stageId).toBe('initiatives')
  })

  it('بلا إشارة hasTows (غير ممرَّرة) → لا اقتراح (افتراض آمن)', () => {
    const c = { ...NONE, environment: true, synthesis: true }
    const r = getNextStep(base({ path: 'MEDIUM', completions: c }))
    expect(r.stageId).toBe('directions')
  })
})
