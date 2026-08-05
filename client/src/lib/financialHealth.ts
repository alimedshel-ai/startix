// ─── محرّك الصحّة الماليّة — ترجيح مُقيَّد بفيتوات سيولة صلبة (نقيّ، معزول) ──
// المصدر: COMPUTE_FINANCIAL_HEALTH_SPEC.md §٣ (الأوزان) + §٤ (الفيتوات).
// الدرس المحوريّ (§١): دالّة الترجيح وحدَها تكذب — بمتوسّط بسيط أو مرجَّح تُقرأ
// شركةٌ سيولتها الفوريّة ٠٫١١ على أنّها «ممتازة ٧٦٫٧» لأنّ مؤشّرات الربح/الملاءة
// منتفخة بنيويّاً (ROE ٩٢٪، هامش ٩٧٪). الحلّ: قاعدة فيتو صلبة فوق الترجيح تُنزلها
// إلى «طوارئ ٣٠» — لا تستبدل الترجيح بل تحدّه (يطابق منطق dangerZone === 'RED').
//
// **دالّة صرفة بحتة:** لا DB، لا opex، لا واجهة (نمط hrFinancialImpact/classify).
// المتّصل (§٥) يربطها في سطر الصحّة: healthPct = min(auditHealthPct, fin.healthPct)
// قبل تمريرها إلى classifyClient. كل مُدخَل مفقود (≤٠ حيث ٠ مستحيلٌ كقيمة حقيقيّة)
// يُعاد توزيع وزنه على بقيّة مجموعته — لا يُحتسَب ١٠٠ (نمط IFERROR §٧).

/** مؤشّرات الشركة الاثنا عشر — نِسبٌ خام لا نقاطاً (§٣ + §٤). */
export interface FinancialKpis {
  instantLiquidity: number   // السيولة الفوريّة (نقد/التزامات متداولة) — الهدف ≥ ١٫٠
  quickRatio: number         // السيولة السريعة — الهدف ≥ ١٫٥
  collectionRate: number     // نسبة التحصيل (٠..١) — الهدف ≥ ٠٫٩٥
  receivables: number        // ذمم العملاء (ريال) — أقلّ أفضل
  receivablesTarget: number  // هدف الذمم حسب القطاع (ريال)
  debtToEquity: number       // الدين/حقوق الملكيّة — الهدف ≤ ١٫٠
  workingCapital: number     // رأس المال العامل (ريال) — الهدف > ٠
  payrollToRevenue: number   // رواتب/إيرادات — الهدف ≤ ٠٫٣٠
  materialsToRevenue: number // مواد/إيرادات — الهدف ≤ ٠٫٣٥ (٠ = فجوة بيانات، لا تميّز)
  revenuePerDirectEmployee: number // إيراد/موظّف مباشر (ريال) — حسب القطاع
  netMargin: number          // ربحيّة صافية (٠..١) — الهدف ≥ ٠٫٢٠
  grossMargin: number        // هامش إجماليّ (٠..١) — الهدف ≥ ٠٫٦٥
  roe: number                // العائد على حقوق الملكيّة — الهدف ≥ ٠٫١٥
}

export interface FinancialHealth {
  /** الصحّة الماليّة ٠..١٠٠ بعد الترجيح والفيتوات (مقرَّبة). */
  healthPct: number
  /** رموز الفيتوات المُفعَّلة (§٤) — تُعرَض نصّاً في الواجهة. */
  vetoes: string[]
  /** مساهمة كل مؤشّر محسوب بالنقاط (من ١٠٠) — للشفافيّة، يُسقِط المفقود. */
  breakdown: Record<string, number>
}

/** هدف إيراد/موظّف مباشر افتراضيّ (ريال) — قيمة مبدئيّة حتى يمرّر المتّصل القطاع. */
export const REVENUE_PER_EMPLOYEE_TARGET_DEFAULT = 200_000

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const finite = (n: number) => typeof n === 'number' && isFinite(n)

/** «أعلى أفضل»: قيمة/هدف مقصوصة على ١. غير منتهٍ → مفقود (null فيُعاد توزيعه).
 *  الصفر/السالب قيمةٌ حقيقيّة رديئة (خسارة، سيولة معدومة) لا فجوة → يُسجَّل ٠. */
const higher = (v: number, target: number): number | null => (finite(v) ? clamp01(v / target) : null)

/** «أقلّ أفضل»: هدف/قيمة مقصوصة على ١. القيمة ≤ ٠ فجوةُ بياناتٍ (لا يُسجَّل رقم
 *  للرواتب/المواد صفراً) → null فيُعاد توزيع وزنها على مجموعتها (§٧). */
const lower = (v: number, target: number): number | null => (finite(v) && v > 0 ? clamp01(target / v) : null)

interface Member { key: string; weight: number; score: number | null }
interface Group { name: string; weight: number; members: Member[] }

/**
 * يحسب الصحّة الماليّة: ترجيح ٥ مجموعات (§٣) مقيَّدٌ بفيتوات (§٤).
 * الأوزان الفرعيّة قيمٌ مطلقة تجمع ١٠٠. المفقود يُعاد توزيعه داخل مجموعته،
 * والمجموعة الغائبة كليّاً تُسقَط من المقام (لا تُحتسَب صفراً ولا مئة).
 */
export function computeFinancialHealth(k: FinancialKpis): FinancialHealth {
  const groups: Group[] = [
    { name: 'liquidity', weight: 35, members: [
      { key: 'instantLiquidity', weight: 20, score: higher(k.instantLiquidity, 1.0) },
      { key: 'quickRatio',       weight: 15, score: higher(k.quickRatio, 1.5) },
    ] },
    { name: 'collection', weight: 25, members: [
      { key: 'collectionRate', weight: 15, score: higher(k.collectionRate, 0.95) },
      // ذمم العملاء: الهدف ≤ هدف القطاع. لا ذمم (≤٠) = مثاليّ لا فجوة → ١.
      { key: 'receivables', weight: 10, score:
          finite(k.receivables) && finite(k.receivablesTarget) && k.receivablesTarget > 0
            ? (k.receivables <= 0 ? 1 : clamp01(k.receivablesTarget / k.receivables))
            : null },
    ] },
    { name: 'solvency', weight: 15, members: [
      // دين/حقوق: لا دين (≤٠) = مثاليّ → ١؛ خلاف ذلك هدف/قيمة.
      { key: 'debtToEquity', weight: 10, score:
          finite(k.debtToEquity) ? (k.debtToEquity <= 0 ? 1 : clamp01(1.0 / k.debtToEquity)) : null },
      // رأس مال عامل: ثنائيّ — موجب = ١، صفر/سالب = ٠ (عجزٌ حقيقيّ، لا يُخفى).
      { key: 'workingCapital', weight: 5, score: finite(k.workingCapital) ? (k.workingCapital > 0 ? 1 : 0) : null },
    ] },
    { name: 'efficiency', weight: 15, members: [
      { key: 'payrollToRevenue',        weight: 5, score: lower(k.payrollToRevenue, 0.30) },
      { key: 'materialsToRevenue',      weight: 5, score: lower(k.materialsToRevenue, 0.35) },
      { key: 'revenuePerDirectEmployee', weight: 5, score:
          finite(k.revenuePerDirectEmployee) && k.revenuePerDirectEmployee > 0
            ? clamp01(k.revenuePerDirectEmployee / REVENUE_PER_EMPLOYEE_TARGET_DEFAULT)
            : null },
    ] },
    { name: 'profitability', weight: 10, members: [
      { key: 'netMargin',   weight: 6, score: higher(k.netMargin, 0.20) },
      { key: 'grossMargin', weight: 2, score: higher(k.grossMargin, 0.65) },
      { key: 'roe',         weight: 2, score: higher(k.roe, 0.15) },
    ] },
  ]

  const breakdown: Record<string, number> = {}
  let rawPoints = 0        // مجموع مساهمات المجموعات الحاضرة
  let presentGroupWeight = 0 // مجموع أوزان المجموعات التي فيها مؤشّر واحد محسوب على الأقل

  for (const g of groups) {
    const present = g.members.filter((m): m is Member & { score: number } => m.score != null)
    if (present.length === 0) continue // مجموعة غائبة كليّاً → تُسقَط من المقام
    const presentWeight = present.reduce((s, m) => s + m.weight, 0)
    // متوسّط مرجَّح داخل المجموعة (يعيد توزيع وزن المفقود على الحاضر تلقائيّاً).
    const groupScore01 = present.reduce((s, m) => s + m.score * m.weight, 0) / presentWeight
    for (const m of present) {
      // مساهمة المؤشّر بالنقاط بعد إعادة التوزيع داخل مجموعته.
      breakdown[m.key] = Math.round(m.score * (m.weight / presentWeight) * g.weight * 10) / 10
    }
    rawPoints += g.weight * groupScore01
    presentGroupWeight += g.weight
  }

  // إعادة التطبيع على المجموعات الحاضرة فقط (عادةً ١٠٠ فتساوي rawPoints).
  const base = presentGroupWeight > 0 ? (rawPoints / presentGroupWeight) * 100 : 0

  // ─── §٤: الفيتوات — إلزاميّة، فوق الترجيح لا بدلاً عنه ───────────────
  const vetoes: string[] = []
  const caps: number[] = [base]
  if (finite(k.instantLiquidity) && k.instantLiquidity < 0.5) { vetoes.push('INSTANT_LIQUIDITY'); caps.push(30) }
  if (finite(k.collectionRate) && k.collectionRate < 0.70) { vetoes.push('COLLECTION_RATE'); caps.push(45) }
  if (finite(k.receivables) && finite(k.receivablesTarget) && k.receivablesTarget > 0 && k.receivables > 2 * k.receivablesTarget) {
    vetoes.push('RECEIVABLES'); caps.push(50)
  }

  const healthPct = Math.round(Math.min(...caps))
  return { healthPct, vetoes, breakdown }
}
