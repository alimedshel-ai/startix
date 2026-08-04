// ─── أعلام تشغيل — تبديل زمنيّ بلا إعادة بناء (localStorage) ──────────
// خطّة الإصلاح ن٢: الأسطح عالية الخطر (ربط القمرة) خلف flag مع تراجع فوريّ.
// الافتراض آمن (السلوك القديم)؛ التفعيل يدويّ:
//   localStorage.setItem('flag:USE_RESCUE_PLAN', '1')   // تفعيل
//   localStorage.removeItem('flag:USE_RESCUE_PLAN')     // تراجع للقديم

export function flag(name: string, fallback = false): boolean {
  try {
    const v = localStorage.getItem(`flag:${name}`)
    if (v == null) return fallback
    return v === '1' || v === 'true'
  } catch {
    return fallback
  }
}

// علم قيادة القمرة القديم حُذف في D2 (القمرة صارت تقود بـ useGuidedNext دائماً،
// لا فرع علمٍ موازٍ). الحظر ضدّ عودته بالاسم يعيش في divergentNextGuard.test.ts.

/** الرقعة C — ترحيل سطح الإنقاذ في القمرة من RESCUE_SEQUENCE (أدوات: مخاطر/
 *  أيزنهاور/RACI/جانت) إلى RESCUE_PLAN الدلاليّ (محور ← إجراء ← مبادرة ← إعادة
 *  تدقيق) عبر resolveRescuePlan. الافتراض آمن (القديم)؛ التفعيل يدويّ. */
export const USE_RESCUE_PLAN = 'USE_RESCUE_PLAN'

/** قفل المراحل الصلب: المرحلة المقفلة (canOpenStage=false) غير قابلة للنقر في
 *  السايد بار + حرس مسار يعيد توجيه URL المباشر لها. الافتراض آمن (بلا قفل صلب —
 *  السلوك القديم: تعتيم فقط)؛ التفعيل يدويّ. خطر لو كشف الاكتمال ناقص → خلف flag. */
export const USE_STAGE_LOCK = 'USE_STAGE_LOCK'
