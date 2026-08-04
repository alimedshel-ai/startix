import { describe, expect, it } from 'vitest'

import { analysisPlanFor, ANALYSIS_TOOLS, firstIncompleteAnalysisKey, recommendedForScore, stageOneComplete } from './analysisPlan'
import { artifactSatisfies } from './journeyStages'

describe('analysisPlanFor — المستوى (حجم × صحّة × قطاع)', () => {
  it('صغيرة صحّتها عاديّة → تشغيليّ (العمود الأربعيّ incl. deep، الثقيلة مخفيّة)', () => {
    const p = analysisPlanFor({ size: 'SMALL', sector: 'other', healthPct: 55 })
    expect(p.tier).toBe('operational')
    // البند ١: العمود [audit, deep, s7, pestel] حاضر حتى في التشغيليّة.
    expect(p.recommended).toEqual(['audit', 'deep', 's7', 'pestel'])
    expect(p.advanced).toContain('porter')
    expect(p.advanced).toContain('org-dna')
    expect(p.advanced).not.toContain('deep') // deep عمودٌ لا متقدّم
  })

  it('البند ١ — العمود الأربعيّ [audit, deep, s7, pestel] حاضر بكل الأعماق', () => {
    for (const score of [0, 1, 2]) {
      const r = recommendedForScore(score)
      for (const col of ['audit', 'deep', 's7', 'pestel']) expect(r).toContain(col)
    }
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
    expect(p.recommended[1]).toBe('deep') // البند ١: deep في العمود بعد audit مباشرةً
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
    expect(p.recommended[1]).toBe('deep') // البند ١: deep في العمود بعد audit مباشرةً
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

// ─── تكامل §1.5 (useGuidedNext) — يقفل الإصلاح الذي حسم السلسلة ─────
// يعيد بناء isDone من useGuidedNext:99-104 (viaAudit→hasAudit ؛ وإلا
// artifactBases عبر artifactSatisfies الواعي بالبادئة). هذا هو الفرق
// الذي كسر NextStepCard المحذوف: مطابقته بالتساوي التامّ تُعمي عن _HR.
describe('§1.5 — اكتمال ① بالخطّة المتكيّفة + artifacts الإدارة المُلحَقة', () => {
  function nextIncomplete(
    input: Parameters<typeof analysisPlanFor>[0],
    artifactTypes: string[],
    hasAudit: boolean,
  ): string | null {
    const plan = analysisPlanFor(input)
    const types = new Set(artifactTypes)
    const isDone = (key: string): boolean => {
      const t = ANALYSIS_TOOLS[key]
      if (!t) return true
      if (t.viaAudit) return hasAudit
      return t.artifactBases.some((b) => artifactSatisfies(types, b))
    }
    return firstIncompleteAnalysisKey(plan.recommended, isDone)
  }

  it('«شركة العمود»: مختصر + العمود (deep=MATURITY/7S/PESTEL) + تدقيق → ① مكتملة (→ التوليف)', () => {
    const next = nextIncomplete(
      { size: 'SMALL', sector: 'other', healthPct: 55 },
      ['INTERNAL_ENV_HR', 'PESTEL_HR', 'MATURITY', 'PORTER_HR', 'BENCHMARK_HR'],
      true,
    )
    expect(next).toBeNull() // العمود كلّه مُنجَز رغم لاحقة _HR (deep=MATURITY) → لا قفزة خاطئة
  })

  it('الفرق الحاسم: التساوي التامّ (سلوك NextStepCard المحذوف) كان يُفشِل _HR', () => {
    const types = new Set(['INTERNAL_ENV_HR', 'PESTEL_HR'])
    expect(types.has('INTERNAL_ENV')).toBe(false)               // التساوي التامّ → «ناقص» خطأً
    expect(artifactSatisfies(types, 'INTERNAL_ENV')).toBe(true) // الواعي بالبادئة → مُنجَز صحيحاً
  })

  it('مختصر أنجز التدقيق فقط → ① غير مكتملة، التالي deep (العمود بعد التدقيق — البند ١)', () => {
    expect(nextIncomplete({ size: 'SMALL', sector: 'other', healthPct: 55 }, [], true)).toBe('deep')
  })

  it('معيار الاكتمال يتبع طول recommended لا رقماً ثابتاً (عمود ٤ + رفع القطاع → ٥)', () => {
    const plan = analysisPlanFor({ size: 'SMALL', sector: 'consulting', healthPct: 55 })
    expect(plan.recommended.length).toBe(5) // العمود الأربعيّ + أصحاب (رفع القطاع)
    // أنجز العمود (deep=MATURITY/7S/PESTEL) → تبقى «أصحاب المصلحة» ناقصة، فلا يكتمل ①.
    expect(nextIncomplete({ size: 'SMALL', sector: 'consulting', healthPct: 55 },
      ['INTERNAL_ENV', 'PESTEL', 'MATURITY'], true)).toBe('stakeholders')
  })
})

// ─── الخطوة ٢ — البدائيّتان النقيّتان المرفوعتان ──────────────────
describe('recommendedForScore — الموصى به من طبقة جاهزة (مجمَّدة)', () => {
  it('score=0 → ٤ (العمود: تدقيق/deep/7S/PESTEL — البند ١)', () => {
    expect(recommendedForScore(0, 'other')).toEqual(['audit', 'deep', 's7', 'pestel'])
  })
  it('score=1 → ٧', () => {
    expect(recommendedForScore(1, 'other')).toEqual(['audit', 'deep', 's7', 'value-chain', 'pestel', 'benchmarking', 'stakeholders'])
  })
  it('score=2 → ٩', () => {
    expect(recommendedForScore(2, 'other')).toHaveLength(9)
  })
  it('رفع القطاع يُظهر أداة في موضعها (استشارات score=0 → +أصحاب، أخيراً)', () => {
    expect(recommendedForScore(0, 'consulting')).toEqual(['audit', 'deep', 's7', 'pestel', 'stakeholders'])
  })
  it('يطابق مخرَج analysisPlanFor (مصدر واحد، لا اشتقاق مزدوج)', () => {
    // تشغيليّ عاديّ (score يُشتقّ 0) = recommendedForScore(0)
    expect(analysisPlanFor({ size: 'SMALL', sector: 'other', healthPct: 55 }).recommended)
      .toEqual(recommendedForScore(0, 'other'))
    // تكتيكيّ (score 1) = recommendedForScore(1)
    expect(analysisPlanFor({ size: 'MEDIUM', sector: 'other', healthPct: 65 }).recommended)
      .toEqual(recommendedForScore(1, 'other'))
  })
  it('قفل «لا تأرجح»: الطبقة المجمَّدة لا تعتمد الصحّة — score واحد → قائمة واحدة', () => {
    // بلا مدخل صحّة أصلاً: نفس الرقم يعطي نفس القائمة دائماً (لا يكبر بتعافي العميل).
    const frozen = recommendedForScore(0, 'other')
    expect(frozen).toHaveLength(4) // البند ١: العمود الأربعيّ
    expect(recommendedForScore(0, 'other')).toEqual(frozen) // ثابت مهما تغيّرت الصحّة الحيّة
  })
})

describe('stageOneComplete — الاكتمال المشترك (يُرفَع فوق الهوكين)', () => {
  const rec0 = recommendedForScore(0, 'other') // [audit, deep, s7, pestel] — العمود (البند ١)

  it('مختصر بتدقيق فقط → غير مكتملة (١ من ٤)', () => {
    expect(stageOneComplete(rec0, new Set<string>(), true)).toBe(false)
  })
  it('مختصر + تدقيق + INTERNAL_ENV_HR + PESTEL_HR + MATURITY(deep) → مكتملة (واعٍ بالبادئة)', () => {
    expect(stageOneComplete(rec0, new Set(['INTERNAL_ENV_HR', 'PESTEL_HR', 'MATURITY']), true)).toBe(true)
  })
  it('بلا تدقيق → غير مكتملة حتى لو وُجدت artifacts أخرى', () => {
    expect(stageOneComplete(rec0, new Set(['INTERNAL_ENV_HR', 'PESTEL_HR', 'MATURITY']), false)).toBe(false)
  })
  it('قفل «لا تأرجح»: عميل مريض أكمل العمود (score مجمَّد=0) يبقى مكتملاً وإن كان الحيّ سيطلب ٧', () => {
    const done = new Set(['INTERNAL_ENV_HR', 'PESTEL_HR', 'MATURITY']) // العمود incl. deep=MATURITY
    expect(stageOneComplete(recommendedForScore(0, 'other'), done, true)).toBe(true)  // المجمَّد ٣ → مكتمل
    expect(stageOneComplete(recommendedForScore(1, 'other'), done, true)).toBe(false) // لو أُعيد حسابه حيّاً (٧) لانفتح — لهذا نجمّد
  })
})
