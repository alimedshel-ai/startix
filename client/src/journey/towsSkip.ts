// ─── تخطّي توصية TOWS الناعمة (لكل عميل) ──────────────────────────────────────
// قرار المالك: TOWS تُقترَح لا تُلزَم — وزر «تخطّى» يكتم التوصية لهذا العميل فلا
// تعود. يُخزَّن محليًّا (تفضيل عرض، لا حالة أعمال) ويُبَثّ حدثٌ ليُعاد حساب «التالي».
const KEY = (companyId: string) => `startix:tows-skipped:${companyId}`
export const TOWS_SKIP_EVENT = 'startix:tows-skipped'

export function isTowsSkipped(companyId: string | null | undefined): boolean {
  if (!companyId || typeof localStorage === 'undefined') return false
  try { return localStorage.getItem(KEY(companyId)) === '1' } catch { return false }
}

export function skipTows(companyId: string): void {
  try { localStorage.setItem(KEY(companyId), '1') } catch { /* وضع خاصّ/SSR */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOWS_SKIP_EVENT, { detail: { companyId } }))
  }
}
