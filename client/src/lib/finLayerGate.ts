// ─── ح٢: بوّابة الطبقة ١ + قواعد فتح الطبقة ٢ (ف١–ف٤) — محرّك نقيّ ─────────────
// ق٤: الطبقة ١ إلزاميّة (GUARD)؛ ق٥: الطبقة ٢ تُفتح بقواعد من نتائج الطبقة ١ — لا
// أحد يُسأل كل شيء. المصدر الملزم للقواعد = ورقة ٢ من بنك طبقات الجمع. لا يمسّ
// المحرّك ولا الدرجة الحيّة (ق٧/ق٩) — تنظيم فتحٍ فقط.

import type { FinancialKpis } from './financialHealth'

/** الحقول العشرة المباشرة للطبقة ١ (ورقة ١). */
export const LAYER1_FIELDS = [
  'FINQ_CURR_LIAB', 'FINQ_CURR_ASSET', 'FINQ_AR', 'FINQ_AR_COLLECTED', 'FINQ_AR_TARGET',
  'FINQ_DEBT', 'FINQ_EQUITY', 'FINQ_NET_PROFIT', 'FINQ_GROSS_PROFIT', 'FND_MAT',
] as const
/** الأساس المشترك (من HR_QUANT.financial، ق٨). */
export const LAYER1_SHARED = ['FND_CASH', 'FND_HEADCOUNT', 'FND_SAL', 'FND_ANNUAL_REVENUE'] as const

const has = (present: Record<string, number>, k: string) =>
  typeof present[k] === 'number' && isFinite(present[k])

/** الحقول الناقصة لإكمال الطبقة ١ (تُقفَل حتى تكتمل — ق٤). */
export function layer1Missing(present: Record<string, number>): string[] {
  return [...LAYER1_FIELDS, ...LAYER1_SHARED].filter((k) => !has(present, k))
}
export function layer1Complete(present: Record<string, number>): boolean {
  return layer1Missing(present).length === 0
}

export type DetailPackage = 'receivables' | 'loans'

/**
 * قواعد فتح الطبقة ٢ من مؤشّرات/فيتوهات الطبقة ١ (ف١–ف٤). المصدر الملزم ورقة ٢.
 * ف١ سيولة ضعيفة ← الذمم + القروض · ف٢ تحصيل/ذمم ← الذمم · ف٣ مديونية ← القروض ·
 * ف٤ لا شيء ← لا فتح (رسالة «وضعك سليم»).
 */
export function openPackages(
  kpis: Partial<FinancialKpis>,
  vetoes: string[],
): { packages: DetailPackage[]; fired: string[] } {
  const pkgs = new Set<DetailPackage>()
  const fired: string[] = []
  const n = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

  // ف١ — فيتو السيولة (<0.5) أو السريعة <1.5
  if ((n(kpis.instantLiquidity) && kpis.instantLiquidity < 0.5) || vetoes.includes('INSTANT_LIQUIDITY') ||
      (n(kpis.quickRatio) && kpis.quickRatio < 1.5)) {
    fired.push('ف١'); pkgs.add('receivables'); pkgs.add('loans')
  }
  // ف٢ — فيتو التحصيل (<0.70) أو الذمم >2× الهدف
  if ((n(kpis.collectionRate) && kpis.collectionRate < 0.70) ||
      vetoes.includes('COLLECTION_RATE') || vetoes.includes('RECEIVABLES')) {
    fired.push('ف٢'); pkgs.add('receivables')
  }
  // ف٣ — مديونية >1.0
  if (n(kpis.debtToEquity) && kpis.debtToEquity > 1.0) {
    fired.push('ف٣'); pkgs.add('loans')
  }
  // ف٤ — لا شيء انطلق
  if (pkgs.size === 0) fired.push('ف٤')

  return { packages: [...pkgs], fired }
}
