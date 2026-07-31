// ─── حالة المصدر الخارجيّ لـSWOT (يملأ الفرص/التهديدات) — محرّك نقيّ قبل الشاشة ──
// يميّز ثلاث حالات لا حالتين: المصدر مفقود · موجودٌ بلا عوامل (يتيم بمخطّط فارغ
// {} — الوجه الخامس لنمط اليتيم) · جاهزٌ لكن البذر لم يُشغَّل. الرسالة تتبع الحالة،
// فلا «أكمل PESTEL» لمن حفظه بلا عوامل، ولا فراغٌ صامت لمن لا مصدر له.

export type ExternalSourceState = 'missing' | 'empty' | 'ready'

/**
 * @param hasExternalArtifact هل يوجد سجلّ PESTEL/Porter (حتى لو محتواه {})؟
 * @param externalFactorCount عدد العوامل التي تُولّد فرصاً/تهديدات فعليّاً.
 */
export function externalSourceState(
  hasExternalArtifact: boolean,
  externalFactorCount: number,
): ExternalSourceState {
  if (!hasExternalArtifact) return 'missing'
  if (!(externalFactorCount > 0)) return 'empty'
  return 'ready'
}
