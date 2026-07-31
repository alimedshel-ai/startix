// ─── هل لهذا الـartifact محتوى فعليّ؟ (محرّك قبل شاشة — دالّة نقيّة) ──────
// المشكلة: سجلّ artifact قد يُحفَظ بمحتوى فارغ (`{}` أو `{political:[],economic:[]}`).
// فحص وجود النوع وحده (artifactSatisfies) يمرّره كـ«جاهز» — فيُوجَّه العميل لـSWOT
// بلا فرص/تهديدات فعليّة. هذه الدالّة تُميّز «محفوظ» عن «مملوء».
//
// صامدة للشكل: تبحث تعاوديّاً عن أيّ ورقة غير فارغة، فلا تعتمد على مخطّط PESTEL
// الدقيق — `{}` و`{political:[]}` كلاهما يُعدّ فارغاً؛ أوّل عامل حقيقيّ ⇒ محتوى.

export function deepHasContent(v: unknown): boolean {
  if (v == null) return false
  if (Array.isArray(v)) return v.some(deepHasContent)
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(deepHasContent)
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return true
  return false // boolean/غيره لا يُعدّ محتوى
}
