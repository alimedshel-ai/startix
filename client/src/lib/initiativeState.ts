// ─── حالة المبادرة + بوابة الاكتمال (الرقعة A) ────────────────────────────
// المولّد كان يُنشئ كل نقطة ضعف كبطاقة مبادرة «مخطّطة» فارغة → صفحة «مبادراتي»
// تمتلئ يتامى. المنع في المولّد: المولَّدة تولد «مقترحة» (لا تدخل القائمة ولا
// العدّاد)، ولا تُرقّى إلى «مخطّطة» إلا باكتمال حقولها. الشارة مُشتقّة لا مخزّنة.

// الحالة الابتدائية لأي مبادرة مولّدة — قسم «مقترحات» منفصل، خارج «مبادراتي».
export const GENERATED_STATUS = 'suggested'
// الحالة المعتمَدة بعد الترقية.
export const PROMOTED_STATUS = 'planned'

export function isSuggested(status: string | null | undefined): boolean {
  return status === GENERATED_STATUS
}

type InitiativeFields = {
  objectiveId?: string | null
  level?: string | null
  cost?: number | string | null
}

// الحقول الناقصة من الثلاثة (هدف · مستوى · تكلفة) — مُشتقّة لا مخزّنة (أ٣).
// costUnestimatedAck: علمٌ يميّز «التكلفة غير مقدَّرة صراحةً» عن «ناقصة» (أ٢)،
// فلا تُحبَس مبادرةٌ لأنّ تكلفتها غير معروفة قصداً.
export function missingFields(
  i: InitiativeFields,
  opts?: { costUnestimatedAck?: boolean },
): Array<'goal' | 'level' | 'cost'> {
  const missing: Array<'goal' | 'level' | 'cost'> = []
  if (!i.objectiveId) missing.push('goal')
  if (!i.level) missing.push('level')
  if (i.cost == null && !opts?.costUnestimatedAck) missing.push('cost')
  return missing
}

// شارة «يتيمة» — بلا هدف استراتيجيّ. مُشتقّة من الحقل لا مخزّنة كنصّ (أ٣).
export function isOrphan(i: InitiativeFields): boolean {
  return !i.objectiveId
}

// بوابة الترقية «مقترح → مخطّط» (أ٢): تتطلّب اكتمال الحقول الثلاثة (أو إقرار
// التكلفة غير المقدَّرة). تُرجِع الناقص كي تُعرَض للمستخدم بدل رفضٍ صامت.
export function canPromote(
  i: InitiativeFields,
  opts?: { costUnestimatedAck?: boolean },
): { ok: boolean; missing: Array<'goal' | 'level' | 'cost'> } {
  const missing = missingFields(i, opts)
  return { ok: missing.length === 0, missing }
}
