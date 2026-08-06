// ─── التوصيلة: الكمّي → بذور مبادرات موسومة بالطبقة (محرّك نقيّ، بلا واجهة) ──
// المشكلة (بوّابة الأدلّة): الكمّي (مؤشّرات · توطين · §د) يُحفظ ولا يدخل قمع توليد
// المبادرات (generateFromAll) — بينما الوصفيّ موصول. هذا الملفّ يحوّل نتائج الكمّي
// إلى «بذور» بنفس شكل الفروع الثمانية، **موسومةً بطبقتها**:
//   • إلزاميّ (mandatory) = المجموعة النظاميّة الموجودة COMPLIANCE_COUNTERS
//     (إقامات · رخص · تأمين · عقود) + فجوة التوطين — مصدرُ حقيقةٍ واحد لا جدولٌ مُختلَق.
//   • تحسينيّ (improvement) = سائر المؤشّرات خارج الهدف.
// الطبقة بُعدٌ مستقلّ عن priority (النوع لا الإلحاح). §د يُدمج كتفصيلٍ لا مبادرةٍ مكرّرة.
// نقيّ + قابل للاختبار: يأخذ نتائج محسوبة ويُخرج بذوراً؛ الإزالة (بالمعرّف + العابرة
// للمصدر) دالّةٌ نقيّة ثانية يستدعيها القمع.

import { COMPLIANCE_COUNTERS } from './hrQuantDerive'
import { HR_QUANT_INDICATORS, isVisibleForSize, type QuantIndicator } from './hrQuantIndicators'

export type GapLayer = 'mandatory' | 'structural' | 'improvement'
export type SeedPriority = 'critical' | 'high' | 'medium' | 'low'

export interface QuantInitiativeSeed {
  /** معرّف المصدر — للإزالة بالمعرّف (KPI_OPR_04 · SAUD_<ruleId>). ثابتٌ عبر التوليدات. */
  sourceId: string
  title: string
  description: string
  priority: SeedPriority
  layer: GapLayer
  /** كلماتٌ دلاليّة للإزالة العابرة للمصدر (توطينٌ كمّيّ ↔ مبادرة توطينٍ قائمة من TOWS).
   *  فارغةٌ لغير التوطين — المعرّف وحده يكفيها. */
  semanticKeys: string[]
}

const REGULATORY = new Set(COMPLIANCE_COUNTERS) // KPI_OPR_04/05/06/11 — نظاميّ إلزاميّ

/** خارج الهدف: أدنى‑أفضل ⇒ actual>target · أعلى‑أفضل ⇒ actual<target. null/غير رقميّ ⇒ لا. */
function isOffTarget(ind: QuantIndicator, actual: number | null | undefined): boolean {
  if (actual == null || !Number.isFinite(actual)) return false
  return ind.direction === 'lower' ? actual > ind.target : actual < ind.target
}

export interface SaudCategorySeed {
  ruleId: string
  category: string
  gap: number
  sequenceRequired: boolean
}

export interface QuantToInitiativesInput {
  /** أرقام HR_QUANT المحفوظة (id → قيمة). */
  actuals: Record<string, number | null | undefined>
  size?: string | null
  /** فئات التوطين ذات الفجوة (gap>0 فقط تُمرَّر أو تُفلتَر داخليّاً). */
  saudization?: SaudCategorySeed[] | null
  /** §د — الحلّ الأوفر: يُدمج كتفصيلٍ ماليّ في بذرة التوطين (لا مبادرة مكرّرة). */
  saudCost?: { bestSolutionAr?: string | null; bestCost?: number | null } | null
}

/**
 * يحوّل الكمّي إلى بذور مبادرات موسومة. الإلزاميّ بلا سقفٍ عدديّ (لا «أضعف ٥»)؛
 * التحسينيّ سائر المؤشّرات خارج الهدف. لا يقرأ المبادرات القائمة — الإزالة منفصلة.
 */
export function quantToInitiatives(input: QuantToInitiativesInput): QuantInitiativeSeed[] {
  const seeds: QuantInitiativeSeed[] = []

  // ① المؤشّرات خارج الهدف — النظاميّة إلزاميّة، والباقي تحسينيّ.
  for (const ind of HR_QUANT_INDICATORS) {
    if (!isVisibleForSize(ind, input.size)) continue
    const actual = input.actuals[ind.id]
    if (!isOffTarget(ind, actual)) continue
    // KPI_STR_04 (توطين) و KPI_STR_05 (امتثال مشتقّ) لا يُوسَمان هنا: التوطين له فرعه،
    // والامتثال مشتقٌّ من العدّادات الأربعة (تجنّب الازدواج).
    if (ind.id === 'KPI_STR_04' || ind.id === 'KPI_STR_05') continue

    const mandatory = REGULATORY.has(ind.id)
    if (mandatory) {
      seeds.push({
        sourceId: ind.id,
        title: `⚠ [نظاميّ] معالجة: ${ind.name} — ${actual} ${ind.unit}`.slice(0, 100),
        description: `مخالفةٌ نظاميّة من المؤشّرات الكمّية (${ind.id}): الفعليّ ${actual} ${ind.unit}، والمطلوب ${ind.target}. تعرّضٌ للغرامة — يُعالَج أوّلاً.`,
        priority: 'critical',
        layer: 'mandatory',
        semanticKeys: [],
      })
    } else {
      seeds.push({
        sourceId: ind.id,
        title: `تحسين: ${ind.name}`.slice(0, 100),
        description: `مؤشّرٌ خارج الهدف (${ind.id}): من ${actual} إلى ${ind.target} ${ind.unit}.`,
        priority: 'medium',
        layer: 'improvement',
        semanticKeys: [],
      })
    }
  }

  // ② فجوة التوطين — نظاميّة إلزاميّة؛ المقصورة تسلسلٌ إلزاميّ. §د يُدمج كتفصيل.
  const costDetail = saudCostDetail(input.saudCost)
  for (const cat of input.saudization ?? []) {
    if (cat.gap <= 0) continue
    const seq = cat.sequenceRequired
      ? ' (مقصورة ١٠٠٪ — تسلسل إلزاميّ: توظيف سعوديّ ورفع عقده، ثمّ تغيير مهنة غير السعوديّ)'
      : ''
    seeds.push({
      sourceId: `SAUD_${cat.ruleId}`,
      title: `⚠ [نظاميّ] إغلاق فجوة توطين ${cat.category}: ${cat.gap} موظّف`.slice(0, 100),
      description: `فجوة توطين نظاميّة في «${cat.category}»: ${cat.gap} موظّف${seq}.${costDetail}`,
      priority: 'critical',
      layer: 'mandatory',
      semanticKeys: ['توطين', 'سعودة', 'سعوديين', 'السعودة', 'نطاقات'],
    })
  }

  return seeds
}

function saudCostDetail(cost?: { bestSolutionAr?: string | null; bestCost?: number | null } | null): string {
  if (!cost || cost.bestCost == null) return ''
  const sol = cost.bestSolutionAr ? `${cost.bestSolutionAr}` : 'الحلّ الأوفر'
  return ` بالحلّ الأوفر: ${sol}، بتكلفة ${Math.round(cost.bestCost).toLocaleString('ar-SA')} ريال/سنة.`
}

/**
 * إزالةٌ نقيّة على مستويين — تُستدعى قبل الإنشاء:
 *   • بالمعرّف: لا بذرتين بنفس sourceId (أمانٌ لو تكرّر مصدر).
 *   • العابرة للمصدر (الحالة الأخطر): بذرةٌ لها semanticKeys ويطابق أحدُها **عنوان
 *     مبادرةٍ قائمة** ⇒ تُسقَط (المبادرة القائمة تعالج نفس الفجوة من مصدرٍ آخر —
 *     توطينٌ كمّيّ فوق «توظيف سعوديين» من TOWS = واحدة لا اثنتان).
 * existingTitles تُطبَّع خارجاً (titleKey) أو تُمرَّر خاماً — نطابق تضمّناً بسيطاً.
 */
export function dedupeQuantSeeds(seeds: QuantInitiativeSeed[], existingTitles: string[]): QuantInitiativeSeed[] {
  const seenIds = new Set<string>()
  const titles = existingTitles.map((t) => t ?? '')
  const out: QuantInitiativeSeed[] = []
  for (const s of seeds) {
    if (seenIds.has(s.sourceId)) continue // إزالة بالمعرّف
    const crossDup = s.semanticKeys.length > 0 && titles.some((t) => s.semanticKeys.some((k) => t.includes(k)))
    if (crossDup) continue // إزالة عابرة للمصدر
    seenIds.add(s.sourceId)
    out.push(s)
  }
  return out
}
