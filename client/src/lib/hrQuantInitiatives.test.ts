import { describe, expect, it } from 'vitest'

import { dedupeQuantSeeds, quantToInitiatives, type QuantInitiativeSeed } from './hrQuantInitiatives'

describe('quantToInitiatives — الكمّي → بذور موسومة', () => {
  it('عدّاد نظاميّ خارج الهدف (OPR_04>0) → إلزاميّ حرج', () => {
    const seeds = quantToInitiatives({ actuals: { KPI_OPR_04: 3 } })
    expect(seeds).toHaveLength(1)
    expect(seeds[0]).toMatchObject({ sourceId: 'KPI_OPR_04', layer: 'mandatory', priority: 'critical' })
    expect(seeds[0].title).toContain('نظاميّ')
  })

  it('كلّ العدّادات النظاميّة الأربعة تُوسَم إلزاميّة — بلا سقفٍ عدديّ', () => {
    const seeds = quantToInitiatives({ actuals: { KPI_OPR_04: 1, KPI_OPR_05: 2, KPI_OPR_06: 1, KPI_OPR_11: 4 } })
    const mand = seeds.filter((s) => s.layer === 'mandatory')
    expect(mand.map((s) => s.sourceId).sort()).toEqual(['KPI_OPR_04', 'KPI_OPR_05', 'KPI_OPR_06', 'KPI_OPR_11'])
  })

  it('مؤشّرٌ غير نظاميّ خارج الهدف → تحسينيّ (KPI_TAC_08 التزام الرواتب 80<100)', () => {
    const seeds = quantToInitiatives({ actuals: { KPI_TAC_08: 80 } })
    expect(seeds).toHaveLength(1)
    expect(seeds[0]).toMatchObject({ sourceId: 'KPI_TAC_08', layer: 'improvement', priority: 'medium' })
  })

  it('على الهدف أو null → لا بذرة (حارس)', () => {
    expect(quantToInitiatives({ actuals: { KPI_OPR_04: 0 } })).toHaveLength(0) // هدف العدّاد ٠
    expect(quantToInitiatives({ actuals: { KPI_TAC_08: 100 } })).toHaveLength(0)
    expect(quantToInitiatives({ actuals: { KPI_OPR_04: null, KPI_OPR_05: undefined } })).toHaveLength(0)
    expect(quantToInitiatives({ actuals: {} })).toHaveLength(0)
  })

  it('STR_04 (توطين) وSTR_05 (امتثال مشتقّ) لا يُوسَمان هنا — تجنّب الازدواج', () => {
    const seeds = quantToInitiatives({ actuals: { KPI_STR_04: 50, KPI_STR_05: 60 } })
    expect(seeds).toHaveLength(0)
  })

  it('فجوة توطين → إلزاميّ؛ المقصورة تُضيف نصّ التسلسل', () => {
    const seeds = quantToInitiatives({
      actuals: {},
      saudization: [
        { ruleId: 'admin_support', category: 'المهن الإدارية', gap: 4, sequenceRequired: true },
        { ruleId: 'general', category: 'عام', gap: 2, sequenceRequired: false },
      ],
    })
    expect(seeds).toHaveLength(2)
    expect(seeds[0]).toMatchObject({ sourceId: 'SAUD_admin_support', layer: 'mandatory' })
    expect(seeds[0].description).toContain('تسلسل إلزاميّ')
    expect(seeds[1].description).not.toContain('تسلسل إلزاميّ')
  })

  it('§د يُدمج كتفصيلٍ ماليّ في بذرة التوطين — لا مبادرة مكرّرة', () => {
    const seeds = quantToInitiatives({
      actuals: {},
      saudization: [{ ruleId: 'general', category: 'عام', gap: 2, sequenceRequired: false }],
      saudCost: { bestSolutionAr: 'تغيير المهنة', bestCost: 48000 },
    })
    expect(seeds).toHaveLength(1) // مبادرةٌ واحدة، لا اثنتان
    expect(seeds[0].description).toContain('الحلّ الأوفر: تغيير المهنة')
    expect(seeds[0].description).toContain('ريال/سنة')
  })

  it('فجوة صفريّة لا تُنتج بذرة', () => {
    const seeds = quantToInitiatives({ actuals: {}, saudization: [{ ruleId: 'x', category: 'ص', gap: 0, sequenceRequired: false }] })
    expect(seeds).toHaveLength(0)
  })
})

describe('dedupeQuantSeeds — الإزالة بالمعرّف + العابرة للمصدر', () => {
  const saudSeed = (id: string): QuantInitiativeSeed => ({
    sourceId: id, title: `توطين ${id}`, description: '', priority: 'critical', layer: 'mandatory',
    semanticKeys: ['توطين', 'سعوديين'],
  })

  it('بالمعرّف: بذرتان بنفس sourceId → واحدة', () => {
    const out = dedupeQuantSeeds([saudSeed('SAUD_a'), saudSeed('SAUD_a')], [])
    expect(out).toHaveLength(1)
  })

  it('العابرة للمصدر (الحالة الأخطر): مبادرةٌ قائمة «توظيف سعوديين» ⇒ تُسقَط بذرة التوطين', () => {
    const out = dedupeQuantSeeds([saudSeed('SAUD_a')], ['خطة توظيف سعوديين ٢٠٢٦'])
    expect(out).toHaveLength(0)
  })

  it('لا تطابق دلاليّ → تبقى البذرة', () => {
    const out = dedupeQuantSeeds([saudSeed('SAUD_a')], ['تطوير المنتج', 'حملة تسويق'])
    expect(out).toHaveLength(1)
  })

  it('بذرة بلا semanticKeys لا تتأثّر بعناوين قائمة', () => {
    const kpiSeed: QuantInitiativeSeed = { sourceId: 'KPI_OPR_04', title: 'x', description: '', priority: 'critical', layer: 'mandatory', semanticKeys: [] }
    expect(dedupeQuantSeeds([kpiSeed], ['أيّ عنوان'])).toHaveLength(1)
  })
})
