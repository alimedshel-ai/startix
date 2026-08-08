// ─── المحرّك المالي المعزول: يبني FinancialKpis من FINQ_*/FND_* — نقيّ بحت ──
// مطابقٌ لوثيقة docs/FIN_QUANT_CROSSOVER.md (مُعتمَد من المالك 2026-08-08).
// نمط hrQuantDerive: لا DB، لا واجهة، لا حالة. مدخلاتٌ رقميّة → قيم FinancialKpis
// جاهزة لتمريرها إلى computeFinancialHealth (الذي يتولّى الترجيح والفيتوات).
//
// **المصدر الواحد (§أ) — قرار المالك:** لا يُعاد حساب مؤشّرَي التداخل هنا؛ يُقرآن من
// طبقة HR الكمّية عبر deriveQuantActual ويُمرَّران كما هما:
//   • revenuePerDirectEmployee ← KPI_STR_06 (ريال، بلا تحويل).
//   • payrollToRevenue ← KPI_STR_01 ÷ 100 (KPI_STR_01 بوحدة ٪، والحقل نسبة ٠..١).
// هذا الملفّ **لا يستورد أي صيغة موازية لهما** (حارس finSingleSourceGuard في ت٢).
//
// **v1: تتبّع وعرض فقط** — لا شيء من هنا يدخل healthPct الحيّ ولا classifyClient.

import type { FinancialKpis } from './financialHealth'
import { deriveQuantActual } from './hrQuantDerive'

/** مدخلات البنك المالي: حقول FINQ_ و FND_ (+ ما يلزم من HRQ_ لقراءة KPI_STR_01 و KPI_STR_06). */
export type FinQuantInputs = Record<string, number>

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n)

/** نسبة تسقط لطيفًا (§0-4): مقامٌ صفر/غائب أو بسطٌ غائب ⇒ null، لا NaN ولا صفر مُختلَق. */
const ratio = (num: number | undefined, den: number | undefined): number | null =>
  isNum(num) && isNum(den) && den !== 0 ? num / den : null

/** فرقٌ مطلق (رأس المال العامل): طرفان حاضران ⇒ الفرق، وإلّا null. */
const diff = (a: number | undefined, b: number | undefined): number | null =>
  isNum(a) && isNum(b) ? a - b : null

/**
 * يبني الجزء المتوفّر من FinancialKpis من مدخلات البنك. الحقول الغائبة **تبقى غائبة**
 * (Partial) فيتولّى computeFinancialHealth إعادة توزيع الوزن (§7) — لا نختلق أرقامًا.
 * التداخلان (§أ) يُقرآن من HR ولا يُعاد حسابهما.
 */
export function deriveFinancialKpis(inp: FinQuantInputs): Partial<FinancialKpis> {
  const k: Partial<FinancialKpis> = {}
  const set = <K extends keyof FinancialKpis>(key: K, v: number | null) => {
    if (v != null) k[key] = v
  }

  // — سيولة —
  set('instantLiquidity', ratio(inp.FND_CASH, inp.FINQ_CURR_LIAB))
  set('quickRatio', ratio(isNum(inp.FND_CASH) && isNum(inp.FINQ_AR) ? inp.FND_CASH + inp.FINQ_AR : undefined, inp.FINQ_CURR_LIAB))

  // — تحصيل / ذمم —
  set('collectionRate', ratio(inp.FINQ_AR_COLLECTED, inp.FINQ_AR))
  if (isNum(inp.FINQ_AR)) set('receivables', inp.FINQ_AR)
  if (isNum(inp.FINQ_AR_TARGET)) set('receivablesTarget', inp.FINQ_AR_TARGET)

  // — ملاءة —
  set('debtToEquity', ratio(inp.FINQ_DEBT, inp.FINQ_EQUITY))
  set('workingCapital', diff(inp.FINQ_CURR_ASSET, inp.FINQ_CURR_LIAB))

  // — كفاءة —
  // ⚠️ §أ: لا حساب مستقلّ — يُقرآن من طبقة HR (المصدر الواحد، قرار المالك).
  set('payrollToRevenue', pct01(deriveQuantActual('KPI_STR_01', inp)))       // KPI_STR_01 ٪ → نسبة
  set('revenuePerDirectEmployee', deriveQuantActual('KPI_STR_06', inp))       // ريال، كما هو
  set('materialsToRevenue', ratio(isNum(inp.FND_MAT) ? inp.FND_MAT * 12 : undefined, inp.FND_ANNUAL_REVENUE))

  // — ربحيّة —
  set('netMargin', ratio(inp.FINQ_NET_PROFIT, inp.FND_ANNUAL_REVENUE))
  set('grossMargin', ratio(inp.FINQ_GROSS_PROFIT, inp.FND_ANNUAL_REVENUE))
  set('roe', ratio(inp.FINQ_NET_PROFIT, inp.FINQ_EQUITY))

  return k
}

/** يحوّل نسبة مئويّة (٠..١٠٠) من طبقة HR إلى نسبة (٠..١)، مع الحفاظ على null. */
function pct01(v: number | null): number | null {
  return v == null ? null : v / 100
}
