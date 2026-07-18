import { describe, expect, it } from 'vitest'

import {
  assertCleanText,
  createTaggedItem,
  fromLegacy,
  fromStorage,
  mergePreservingUserEdits,
  normalizeText,
  summarizeMerge,
  toStorage,
  type TaggedItem,
} from './taggedItem'

// ═══════════════════════════════════════════════════════════════
// Article 1 (مُحدَّث) — النظافة تُفرَض على الآلي فقط؛ نصّ المستخدم مقدّس
// ═══════════════════════════════════════════════════════════════

describe('Article 1 — assertCleanText (origin-aware)', () => {
  it('يقبل النصّ الآلي النظيف', () => {
    expect(() => assertCleanText('نصّ عادي', 'auto')).not.toThrow()
    expect(() => assertCleanText('رموز مسموحة ✓ ⚠️ «»', 'auto')).not.toThrow()
  })

  it('يرفض النصّ الآلي الذي يحوي ⟪ أو ⟫', () => {
    expect(() => assertCleanText('نصّ ⟪مصدر:X⟫', 'auto')).toThrow(/Article 1 violation/)
    expect(() => assertCleanText('نصّ⟫', 'auto')).toThrow(/Article 1 violation/)
  })

  it('نصّ المستخدم يمرّ حتى لو حوى ⟪ (مقدّس، بلا فحص)', () => {
    expect(() => assertCleanText('شركة ⟪الأنيقة⟫', 'user:u1')).not.toThrow()
  })

  it('يُلحق context في رسالة الخطأ', () => {
    expect(() => assertCleanText('bad ⟪', 'auto', 'test-ctx')).toThrow(/test-ctx/)
  })
})

describe('normalizeText — تطبيع عربي', () => {
  it('يوحّد الرسم المتغيّر: «الإدارة» = «الاداره»', () => {
    expect(normalizeText('الإدارة')).toBe(normalizeText('الاداره'))
  })

  it('يزيل التشكيل ويوحّد الهمزات والألف المقصورة', () => {
    expect(normalizeText('أحمد')).toBe('احمد')
    expect(normalizeText('مُنشأة')).toBe('منشاه')
    expect(normalizeText('مبنى')).toBe('مبني')
  })

  it('يقصّ ويوحّد حالة الإنجليزية', () => {
    expect(normalizeText('  Google Cloud ')).toBe('google cloud')
  })
})

describe('createTaggedItem', () => {
  it('يُنشئ item يدوي بمعرّف فريد ونصّ كما هو', () => {
    const t = createTaggedItem({ text: 'نقطة قوّة', origin: 'user:u1' })
    expect(t.text).toBe('نقطة قوّة')
    expect(t.origin).toBe('user:u1')
    expect(t.id).toMatch(/.+/)
    expect(t.source).toBeUndefined()
  })

  it('يُنشئ item آلي مع source و reason و ts', () => {
    const t = createTaggedItem({
      text: 'نقطة',
      origin: 'auto',
      source: 'PESTEL',
      reason: 'ضغط تنظيمي',
      ts: '2026-07-13T00:00:00Z',
    })
    expect(t.source).toBe('PESTEL')
    expect(t.reason).toBe('ضغط تنظيمي')
    expect(t.ts).toBe('2026-07-13T00:00:00Z')
  })

  it('يرفض إنشاء item آلي بنصّ ملوّث', () => {
    expect(() =>
      createTaggedItem({ text: 'نصّ ⟪مصدر:X⟫', origin: 'auto' }),
    ).toThrow(/Article 1 violation/)
  })

  it('يحفظ نصّ المستخدم كما هو حتى مع ⟪ (اختبار القبول ٤)', () => {
    const t = createTaggedItem({ text: 'شركة ⟪الأنيقة⟫', origin: 'user:u1' })
    expect(t.text).toBe('شركة ⟪الأنيقة⟫')
    expect(t.origin).toBe('user:u1')
  })

  it('يحترم id الممرَّر، ويولّد فريداً إن غاب', () => {
    const a = createTaggedItem({ id: 'fixed-1', text: 'A', origin: 'user:u1' })
    expect(a.id).toBe('fixed-1')
    const b = createTaggedItem({ text: 'B', origin: 'user:u1' })
    const c = createTaggedItem({ text: 'C', origin: 'user:u1' })
    expect(b.id).not.toBe(c.id)
  })
})

// ═══════════════════════════════════════════════════════════════
// fromLegacy — الشفاء الذاتي من الصيغة القديمة
// ═══════════════════════════════════════════════════════════════

describe('fromLegacy — self-healing من ⟪⟫', () => {
  it('يفكّ ⟪مصدر:X⟫ وينقلها للـsource', () => {
    const t = fromLegacy('لديك محاسب متخصّص ⟪مصدر:التحليل العميق⟫')
    expect(t.text).toBe('لديك محاسب متخصّص')
    expect(t.source).toBe('التحليل العميق')
    expect(t.origin).toBe('auto')
    expect(t.id).toMatch(/.+/)
  })

  it('يفكّ ⟪لماذا:Y⟫ وينقلها للـreason', () => {
    const t = fromLegacy('نصّ ⟪مصدر:PESTEL⟫ ⟪لماذا:ضغط تنظيمي⟫')
    expect(t.text).toBe('نصّ')
    expect(t.source).toBe('PESTEL')
    expect(t.reason).toBe('ضغط تنظيمي')
    expect(t.origin).toBe('auto')
  })

  it('نصّ بلا علامات → origin=user:legacy (افتراض آمن)', () => {
    const t = fromLegacy('شراكة مع Google Cloud')
    expect(t.origin).toBe('user:legacy')
    expect(t.source).toBeUndefined()
  })

  it('يُنظّف بقايا الرموز حتى المشوّهة', () => {
    const t = fromLegacy('نصّ فيه ⟪شيء ناقص')
    expect(t.text).not.toMatch(/[⟪⟫]/)
  })

  it('نصّ فارغ يعود نظيفاً', () => {
    const t = fromLegacy('')
    expect(t.text).toBe('')
    expect(t.origin).toBe('user:legacy')
  })
})

// ═══════════════════════════════════════════════════════════════
// fromStorage — يقرأ الشكلين (جديد + قديم) مع ترقية origin وحقن id
// ═══════════════════════════════════════════════════════════════

describe('fromStorage — قراءة توافقيّة', () => {
  it('يقرأ الشكل الجديد {values, meta}', () => {
    const items = fromStorage({
      values: ['A', 'B', 'C'],
      meta: {
        0: { id: 'x0', origin: 'auto', source: 'PESTEL' },
        2: { id: 'x2', origin: 'auto', source: 'التحليل العميق', reason: 'قدرة نادرة' },
      },
    })
    expect(items).toHaveLength(3)
    expect(items[0].origin).toBe('auto')
    expect(items[0].source).toBe('PESTEL')
    expect(items[1].origin).toBe('user:legacy') // meta[1] غائبة → ترقية آمنة
    expect(items[1].id).toMatch(/.+/)           // id مولَّد رغم غياب meta
    expect(items[2].reason).toBe('قدرة نادرة')
  })

  it('يُرقّي origin=\'user\' القديمة إلى user:legacy', () => {
    const items = fromStorage({
      values: ['A'],
      meta: { 0: { id: 'x', origin: 'user' as unknown as TaggedItem['origin'] } },
    })
    expect(items[0].origin).toBe('user:legacy')
  })

  it('يقرأ الشكل القديم string[] مع علامات ⟪⟫', () => {
    const items = fromStorage([
      'شراكة مع Google Cloud',
      'ضغط تنظيمي ⟪مصدر:PESTEL⟫ ⟪لماذا:عوامل قانونيّة⟫',
    ])
    expect(items).toHaveLength(2)
    expect(items[0].origin).toBe('user:legacy')
    expect(items[0].text).toBe('شراكة مع Google Cloud')
    expect(items[1].origin).toBe('auto')
    expect(items[1].source).toBe('PESTEL')
    expect(items[1].text).toBe('ضغط تنظيمي')
    expect(items[1].text).not.toMatch(/[⟪⟫]/)
  })

  it('يقرأ string[] بلا علامات كـuser:legacy بالكامل', () => {
    const items = fromStorage(['A', 'B', 'C'])
    expect(items).toHaveLength(3)
    expect(items.every((i) => i.origin === 'user:legacy')).toBe(true)
  })

  it('يُرجع [] لأشكال غير معروفة', () => {
    expect(fromStorage(null)).toEqual([])
    expect(fromStorage(undefined)).toEqual([])
    expect(fromStorage(42)).toEqual([])
    expect(fromStorage({ foo: 'bar' })).toEqual([])
  })

  it('يتجاهل عناصر غير نصّيّة في string[]', () => {
    const items = fromStorage(['A', null, 'B', 42, 'C'])
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.text)).toEqual(['A', 'B', 'C'])
  })
})

// ═══════════════════════════════════════════════════════════════
// toStorage — meta دائمة (تحفظ id + origin)؛ نظافة الآلي فقط
// ═══════════════════════════════════════════════════════════════

describe('toStorage', () => {
  it('يفصل values عن meta ويحفظ id + origin لكل بند', () => {
    const u = createTaggedItem({ id: 'u1', text: 'A', origin: 'user:u1' })
    const a = createTaggedItem({ id: 'a1', text: 'B', origin: 'auto', source: 'PESTEL' })
    const storage = toStorage([u, a])
    expect(storage.values).toEqual(['A', 'B'])
    expect(storage.meta[0]).toEqual({ id: 'u1', origin: 'user:u1' })
    expect(storage.meta[1]).toEqual({ id: 'a1', origin: 'auto', source: 'PESTEL' })
  })

  it('يحفظ نصّ المستخدم الحاوي ⟪ بلا خطأ (مقدّس)', () => {
    const u: TaggedItem[] = [{ id: 'u1', text: 'ملاحظة ⟪خاصّة⟫', origin: 'user:u1' }]
    expect(() => toStorage(u)).not.toThrow()
    expect(toStorage(u).values[0]).toBe('ملاحظة ⟪خاصّة⟫')
  })

  it('يرمي خطأ لو نصّ آلي يحوي ⟪⟫', () => {
    const bad: TaggedItem[] = [{ id: 'a1', text: 'ملوّث ⟪', origin: 'auto', source: 'X' }]
    expect(() => toStorage(bad)).toThrow(/Article 1 violation/)
  })

  it('roundtrip: fromStorage(toStorage(x)) يُحافظ على البنود بهويّتها', () => {
    const original: TaggedItem[] = [
      createTaggedItem({ id: 'u1', text: 'يدوي', origin: 'user:u1' }),
      createTaggedItem({ id: 'a1', text: 'آلي', origin: 'auto', source: 'PESTEL', reason: 'س' }),
    ]
    const restored = fromStorage(toStorage(original))
    expect(restored).toEqual(original)
  })
})

// ═══════════════════════════════════════════════════════════════
// اختبارات القبول الأربعة (من قاعدة الفريق المرجعيّة v2)
// ═══════════════════════════════════════════════════════════════

describe('اختبار القبول ١ — حارس الهوية الثابت (Identity Invariant)', () => {
  it('البند اليدوي يبقى بعينه وبمعرّفه بعد ٥ عمليّات توليد', () => {
    const userItem = createTaggedItem({ id: 'u-google', text: 'شراكة مع Google Cloud', origin: 'user:u1' })
    let items: TaggedItem[] = [userItem]

    for (let round = 1; round <= 5; round++) {
      const incoming = [
        { text: `فرصة رقم ${round}` },
        { text: `فرصة أخرى ${round}` },
      ]
      items = mergePreservingUserEdits(items, incoming, 'PESTEL').merged
    }

    // U(X) ≡ U(Y): البند اليدوي موجود بنفس id والنصّ والأصل، مرّة واحدة فقط
    const survivors = items.filter((i) => i.id === 'u-google')
    expect(survivors).toHaveLength(1)
    expect(survivors[0]).toEqual(userItem)
  })
})

describe('اختبار القبول ٢ — استبدال الآلي المُقيَّد بالمصدر', () => {
  it('PESTEL يستبدل بنود PESTEL فقط، ولا يمسّ التحليل العميق والفجوة', () => {
    const existing: TaggedItem[] = [
      createTaggedItem({ text: 'يدوي', origin: 'user:u1' }),
      createTaggedItem({ text: 'قديم من PESTEL', origin: 'auto', source: 'PESTEL' }),
      createTaggedItem({ text: 'من التحليل العميق', origin: 'auto', source: 'التحليل العميق' }),
      createTaggedItem({ text: 'من الفجوة', origin: 'auto', source: 'الفجوة' }),
    ]
    const incoming = [{ text: 'جديد من PESTEL 1' }, { text: 'جديد من PESTEL 2' }]
    const result = mergePreservingUserEdits(existing, incoming, 'PESTEL')

    expect(result.merged.some((i) => i.text === 'يدوي' && i.origin === 'user:u1')).toBe(true)
    expect(result.merged.some((i) => i.text === 'قديم من PESTEL')).toBe(false)
    expect(result.merged.some((i) => i.source === 'التحليل العميق')).toBe(true)
    expect(result.merged.some((i) => i.source === 'الفجوة')).toBe(true)
    expect(result.merged.some((i) => i.text === 'جديد من PESTEL 1')).toBe(true)
    expect(result.merged.some((i) => i.text === 'جديد من PESTEL 2')).toBe(true)

    expect(result.kept).toBe(1)
    expect(result.replaced).toBe(1)
    expect(result.added).toBe(2)
  })
})

describe('اختبار القبول ٣ — Toast + تخطّي المكرّر (تطبيع عربي)', () => {
  it('summarizeMerge يذكر المحفوظ والمحدَّث والجديد والمتخطّى', () => {
    const result = mergePreservingUserEdits(
      [
        createTaggedItem({ text: 'يدوي 1', origin: 'user:u1' }),
        createTaggedItem({ text: 'يدوي 2', origin: 'user:u1' }),
        createTaggedItem({ text: 'قديم', origin: 'auto', source: 'PESTEL' }),
      ],
      [{ text: 'جديد 1' }, { text: 'جديد 2' }, { text: 'يدوي 1' }],
      'PESTEL',
    )
    const toast = summarizeMerge(result, 'PESTEL')
    expect(toast).toContain('حُفظت 2 يدويّة')
    expect(toast).toContain('حُدِّث 1 من PESTEL')
    expect(toast).toContain('جديد 2')
    expect(toast).toContain('تخطّي 1 مكرّر')
    expect(result.skipped_duplicates).toBe(1)
  })

  it('يتخطّى الوارد المطابق بعد التطبيع العربي («الإدارة» ≈ «الاداره»)', () => {
    const existing: TaggedItem[] = [createTaggedItem({ text: 'ضعف الإدارة', origin: 'user:u1' })]
    const result = mergePreservingUserEdits(existing, [{ text: 'ضعف الاداره' }], 'PESTEL')
    expect(result.skipped_duplicates).toBe(1)
    expect(result.added).toBe(0)
    expect(result.merged).toHaveLength(1)
  })

  it('summarizeMerge بلا حركة يُنتج «لا تغيير»', () => {
    const result = mergePreservingUserEdits([], [], 'PESTEL')
    expect(summarizeMerge(result, 'PESTEL')).toBe('لا تغيير من PESTEL')
  })
})

describe('اختبار القبول ٤ — مقاومة تلوّث النصوص', () => {
  it('المستخدم يكتب ⟪ → يُحفظ كما هو ويبقى user (لا تأويل آلي)', () => {
    const item = createTaggedItem({ text: 'شركة ⟪الأنيقة⟫ المحدودة', origin: 'user:u1' })
    const restored = fromStorage(toStorage([item]))
    expect(restored[0].text).toBe('شركة ⟪الأنيقة⟫ المحدودة')
    expect(restored[0].origin).toBe('user:u1') // لم يُصنَّف آلياً بالخطأ
  })

  it('roundtrip بيانات قديمة → toStorage يُنتج نصّاً آلياً نظيفاً', () => {
    const legacy = fromStorage([
      'يدوي بلا علامات',
      'آلي قديم ⟪مصدر:PESTEL⟫ ⟪لماذا:س⟫',
    ])
    const stored = toStorage(legacy)
    // البند الآلي المُهاجَر نظيف؛ اليدوي القديم (user:legacy) لا يُفحَص
    const autoIdx = legacy.findIndex((i) => i.origin === 'auto')
    expect(/[⟪⟫]/.test(stored.values[autoIdx])).toBe(false)
  })
})
