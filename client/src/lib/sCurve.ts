// ─── مولّد منحنى S (Phase 1) ────────────────────────────────────────
// الفلسفة: كثير من التحسينات تسير بمنحنى Sigmoid:
//   البداية بطيئة (تعوّد + بناء أساس) → تسارع في المنتصف → تباطؤ عند الاقتراب من الهدف.
//
// الصيغة الرياضيّة (Logistic sigmoid):
//   Y(t) = baseline + (target - baseline) / (1 + e^(-k * (t - m)))
//   حيث:
//     baseline = القيمة عند البدء
//     target   = القيمة المستهدفة نهاية المسار
//     t        = الشهر (٠ .. duration)
//     m        = نقطة المنتصف (m = duration / 2 افتراضياً — تحوّل عند منتصف المدّة)
//     k        = حدّة الانحدار (٠٫٤ افتراضياً — تعطي منحنى معتدل)

import type { ExpectedPathPoint } from './strategicApi'

export interface SCurveOptions {
  baseline: number
  target: number
  durationMonths: number  // مثال: ١٢ للسنة، ٣ للربع
  midpoint?: number       // نقطة الانقلاب (افتراضي = durationMonths / 2)
  steepness?: number      // حدّة (افتراضي = 0.4)
}

// يُنشئ مصفوفة نقاط شهريّة من الشهر ٠ إلى الشهر durationMonths.
// النتيجة: (durationMonths + 1) نقطة (تشمل نقطة الأساس ونقطة الهدف).
export function generateSCurve(opts: SCurveOptions): ExpectedPathPoint[] {
  const { baseline, target, durationMonths } = opts
  const m = opts.midpoint ?? durationMonths / 2
  const k = opts.steepness ?? 0.4
  const range = target - baseline

  const points: ExpectedPathPoint[] = []
  for (let t = 0; t <= durationMonths; t++) {
    // Sigmoid ينتج قيمة بين ٠ و ١؛ نحوّلها إلى مدى baseline → target.
    const sigmoid = 1 / (1 + Math.exp(-k * (t - m)))
    // معايرة: عند t=٠ نريد baseline بالضبط، وعند t=duration نريد target.
    // Sigmoid عند الحدود لا يصل حرفياً — نطبّق معايرة بسيطة.
    const s0 = 1 / (1 + Math.exp(-k * (0 - m)))
    const sN = 1 / (1 + Math.exp(-k * (durationMonths - m)))
    const normalized = (sigmoid - s0) / (sN - s0)
    const value = baseline + range * normalized
    points.push({ month: t, value: round2(value) })
  }
  return points
}

// إحضار القيمة المتوقّعة لتاريخ معيّن (بحسب عدد الأيام منذ startedAt).
// نستخدم interpolation خطّي بين النقطة الشهريّة الحاليّة والتاليّة.
export function expectedValueAt(
  path: ExpectedPathPoint[],
  startedAt: string | Date,
  now: Date = new Date(),
): number | null {
  if (!path.length) return null
  const start = new Date(startedAt).getTime()
  const days = (now.getTime() - start) / 86400000
  const months = days / 30.44  // متوسّط طول الشهر
  if (months <= 0) return path[0].value
  if (months >= path[path.length - 1].month) return path[path.length - 1].value
  // ابحث عن نقطتَين محيطتَين.
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (months >= a.month && months <= b.month) {
      const frac = (months - a.month) / (b.month - a.month)
      return round2(a.value + (b.value - a.value) * frac)
    }
  }
  return null
}

// مقارنة القيمة الفعليّة مع المتوقّعة → متقدّم / على المسار / متأخّر.
// الحدود بنسبة مئويّة من فارق baseline→target (لا قيمة مطلقة).
export interface GapAnalysis {
  actual: number
  expected: number
  gap: number           // actual - expected
  gapPct: number        // نسبة gap إلى مدى baseline→target
  status: 'ahead' | 'onTrack' | 'behind' | 'severelyBehind'
  labelAr: string
  interpretationAr: string
}

export function analyzeGap(
  actual: number,
  expected: number,
  baseline: number,
  target: number,
): GapAnalysis {
  const gap = actual - expected
  const range = Math.abs(target - baseline) || 1
  const gapPct = (gap / range) * 100

  // اتجاه التحسين: هل الأعلى أفضل (positive) أم الأقل (negative)؟
  const higherIsBetter = target > baseline
  const positiveGap = higherIsBetter ? gap > 0 : gap < 0

  let status: GapAnalysis['status']
  let labelAr: string
  let interpretationAr: string

  const absPct = Math.abs(gapPct)
  if (positiveGap && absPct >= 5) {
    status = 'ahead'
    labelAr = '⬆️ متقدّم على المتوقّع'
    interpretationAr = `أنت أعلى من المسار المتوقّع بـ ${absPct.toFixed(1)}٪ من مدى التحسين — استمرّ.`
  } else if (absPct <= 5) {
    status = 'onTrack'
    labelAr = '✅ على المسار'
    interpretationAr = 'أنت ضمن ±٥٪ من القيمة المتوقّعة — منحنى الأداء يعمل.'
  } else if (absPct <= 15) {
    status = 'behind'
    labelAr = '⚠️ متأخّر عن المتوقّع'
    interpretationAr = `أنت أقلّ من المتوقّع بـ ${absPct.toFixed(1)}٪ — راجع الأسباب وعدّل التكتيك.`
  } else {
    status = 'severelyBehind'
    labelAr = '🔴 تعثّر ملموس'
    interpretationAr = `تأخّرت بـ ${absPct.toFixed(1)}٪ عن المتوقّع — سيناريو التعثّر يستدعي مراجعة الخطّة.`
  }

  return { actual, expected, gap: round2(gap), gapPct: round2(gapPct), status, labelAr, interpretationAr }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
