// ─── ح٥/بند٥: تحذيرات تناقض الأرقام المُدخَلة — دالّة نقيّة ────────────────────
// تنبيه لا يمنع الحفظ (نمط تحذير الراتب القائم). أرقامٌ يستحيل أن تكون صحيحة معًا.
// المصادر: finq (FIN_QUANT) + الأساس المشترك. لا يمسّ المحرّك ولا الدرجة (ق٧/ق٩).

const n = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

/**
 * يُرجِع رسائل التحذير للحالات المتناقضة الثلاث. فارغ = لا تناقض.
 * كل فحص يعمل فقط عند توفّر طرفيه (لا تحذير من حقلٍ غائب).
 */
export function financeContradictions(
  finq: Record<string, number>,
  shared: { annualRevenue?: number },
): string[] {
  const w: string[] = []

  // حقوق الملكية > إجمالي الأصول (مستحيل محاسبيًّا: الملكية جزء من الأصول)
  if (n(finq.FINQ_EQUITY) && n(finq.FINQ_TOTAL_ASSETS) && finq.FINQ_EQUITY > finq.FINQ_TOTAL_ASSETS)
    w.push('⚠️ حقوق الملكية أكبر من إجمالي الأصول — يستحيل محاسبيًّا (الملكية جزء من الأصول). تحقّق من الرقمين. (لا يمنع الحفظ.)')

  // الذمم المدينة > الأصول المتداولة (الذمم جزء من الأصول المتداولة)
  if (n(finq.FINQ_AR) && n(finq.FINQ_CURR_ASSET) && finq.FINQ_AR > finq.FINQ_CURR_ASSET)
    w.push('⚠️ الذمم المدينة أكبر من الأصول المتداولة — والذمم جزءٌ منها. تحقّق من الرقمين. (لا يمنع الحفظ.)')

  // تكلفة المواد السنويّة > الإيراد ومع ذلك يوجد ربح
  if (n(finq.FND_MAT) && n(shared.annualRevenue) && n(finq.FINQ_NET_PROFIT) &&
      finq.FND_MAT * 12 > shared.annualRevenue && finq.FINQ_NET_PROFIT > 0)
    w.push('⚠️ تكلفة المواد السنويّة تتجاوز الإيراد، ومع ذلك صافي الربح موجب — تناقض. راجع تكلفة المواد أو الإيراد أو الربح. (لا يمنع الحفظ.)')

  return w
}
