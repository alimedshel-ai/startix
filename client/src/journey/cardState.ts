// ─── حالة بطاقة الأداة — قاعدة نقيّة مشتركة (الرقعة A) ────────────────
// تُوحِّد كيف تُشتَقّ حالة بطاقة الأداة في صفحة العميل من **المصدر الواحد**
// (useGuidedNext). الغرض: ضمان أن شارة ⭐ في الصفحة وبيكون «التالي لك الآن»
// يشيران لنفس الأداة دائماً — كلاهما يقرأ نفس guidedNext.to.
//
// لا قفل محلّيّ هنا (قرار المالك ٢): قفل المراحل 🔒 يملكه المحرّك
// (journey/stageStatus) على صفحة الرحلة/السايد بار، لا هذه القاعدة. غير المكتمل
// وغير الحاليّ → 'idle' (متاح، لا مقفل).

export type ToolCardState = 'current' | 'done' | 'idle'

export interface CardStateInput {
  /** انتظر تحميل البيانات قبل إظهار أيّ ⭐/✓ (تفادي وميض). */
  dataLoaded: boolean
  /** اكتمال الأداة (isToolDone) — يتقدّم على «الحاليّة». */
  done: boolean
  /** وجهة الخطوة الحاليّة من useGuidedNext (تتضمّن ?client). */
  guidedTo: string | null
  /** مسار بطاقة هذه الأداة (بلا ?client). */
  path: string
  /** لاحقة العميل (`?client=…`) — تُلحَق بالمسار للمطابقة. */
  clientQ: string
}

/**
 * حالة بطاقة الأداة من المصدر الواحد:
 *   • قبل التحميل → 'idle'.
 *   • مكتملة → 'done'.
 *   • تطابق وجهة guidedNext → 'current' (⭐ — نفس ما يشير إليه البيكون).
 *   • غير ذلك → 'idle'.
 */
export function cardStateFor(input: CardStateInput): ToolCardState {
  if (!input.dataLoaded) return 'idle'
  if (input.done) return 'done'
  if (input.guidedTo && input.guidedTo === `${input.path}${input.clientQ}`) return 'current'
  return 'idle'
}
