// ─── ح٤: الأسئلة المُجابة آليًّا (ق٢، ورقة ٥) — دوالّ نقيّة ──────────────────
// ما تشتقّه المنصّة من مُدخَلٍ فعليّ لا يُسأل عنه. القاعدة الحاكمة: **لا اشتقاق من
// حقل فارغ** — إن غاب المصدر يبقى السؤال مطروحًا (تُرجَع null فلا يُضاف). لا شيء
// هنا يدخل healthPct/classifyClient (ق٩) — عرضٌ «المنصّة ترى كذا، صحّح إن لزم».

import { deriveArAging, type Loan } from './finAgingDerive'

export type YPN = 'yes' | 'partial' | 'no'
export interface AutoAnswer {
  q: string      // معرّف السؤال الوصفيّ الذي يُجاب آليًّا
  value: YPN
  basis: string  // المصدر المعروض للمستخدم (شفافيّة — لا رقم صامت)
}

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n)

/**
 * يُنتج الإجابات الآليّة المتاحة من بيانات الطبقتين ١/٢ فقط. الأسئلة التي مصدرها
 * الطبقة ٤ (توقّع ١٣ أسبوعًا · دوران الأصول · ميزانية-مقابل-فعلي) تبقى مطروحة حتى
 * تُعبّأ حزمها. سؤال «استخدام المنصّة = تقييم دوريّ» **غير مُنفَّذ** — قرار مالك معلّق.
 */
export function autoAnswers(d: { finq?: Record<string, number>; loans?: Loan[] }): AutoAnswer[] {
  const out: AutoAnswer[] = []
  const finq = d.finq ?? {}

  // (١) التقارير س٨: تحليل أعمار الذمم >٩٠ يوم — من شرائح الأعمار (ط٢).
  const aging = deriveArAging(finq)
  if (aging && aging.value > 0) {
    const b4 = isNum(finq.FINQ_AR_B4_V) ? finq.FINQ_AR_B4_V : 0
    const ratio = b4 / aging.value
    out.push({
      q: 'reports_ar_aging_over_90',
      value: ratio > 0.25 ? 'no' : 'yes',
      basis: `شريحة +90 = ${Math.round(ratio * 100)}٪ من الذمم (عتبة ٢٥٪)`,
    })
  }

  // (٢) الديون س٣: جدول قروض بأقساط وأرصدة — من وجود loans[] (ط٢).
  if (d.loans && d.loans.length > 0) {
    out.push({ q: 'debt_schedule_exists', value: 'yes', basis: `قائمة قروض (${d.loans.length}) موجودة` })
  }

  // (٣) الديون س٢: نسبة الدين/الملكية — عتبة المحرّك ≤١٫٠ (ق٦، لا «<٠٫٥»).
  if (isNum(finq.FINQ_DEBT) && isNum(finq.FINQ_EQUITY) && finq.FINQ_EQUITY > 0) {
    const de = finq.FINQ_DEBT / finq.FINQ_EQUITY
    out.push({
      q: 'debt_equity_within_threshold',
      value: de <= 1.0 ? 'yes' : 'no',
      basis: `الدين/الملكية = ${de.toFixed(2)} (العتبة المعتمدة ≤ ١٫٠)`,
    })
  }

  return out
}
