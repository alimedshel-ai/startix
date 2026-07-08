import rateLimit from 'express-rate-limit';

// ─── SEC-1 — Rate limiting على مسارات المصادقة ─────────────────────────────
// يحمي من هجمات القوة العمياء وإنشاء الحسابات المؤتمَتة.
// جميع الحدود لكل IP. الرسائل الاستجابية عربية وتتوافق مع شكل
// { error: string } الذي يستخدمه بقية الـ API.

const isProd = process.env.NODE_ENV === 'production';

// خيارات مشتركة:
// - في وضع التطوير نُخفف الحدود جداً لتفادي إحباط المطور،
// - في وضع الإنتاج نطبّق حدوداً واقعية لتوقّف السلوك المسيء.

/** حد تسجيل الدخول: 5 محاولات كل 15 دقيقة لكل IP (10 في dev). */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 5 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'محاولات تسجيل دخول كثيرة — انتظر 15 دقيقة قبل المحاولة مجدداً.' },
});

/** حد إنشاء الحسابات: 3 حسابات كل ساعة لكل IP (20 في dev). */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 3 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'تجاوزت الحدّ المسموح لإنشاء الحسابات — انتظر ساعة قبل المحاولة مجدداً.' },
});

/** حد طلبات إعادة تعيين كلمة المرور: 3 كل ساعة لكل IP. */
export const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 3 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'طلبات إعادة تعيين كثيرة — انتظر ساعة قبل المحاولة مجدداً.' },
});
