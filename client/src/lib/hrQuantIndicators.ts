// ─── بنك المؤشرات الكمّية لإدارة الموارد البشرية (31 مؤشراً / 3 مستويات) ──
// منقول حرفيّاً من ورقة «التحليل الكمّي — المؤشرات» (مواصفة HR v5): id عالميّ +
// axis_code + unit + target + direction. التحليل الكمّي الكامل — بكل أنواع
// الأرقام (٪ · عدد · يوم · ساعة · سنة · ريال · درجة)، لا الأثر الماليّ فقط.
// الأثر الماليّ (§د/hrFinancialImpact) طبقةٌ مشتقّة فوق ٥ من هذه المؤشرات.

export type QuantLevel = 'strategic' | 'tactical' | 'operational'
export type QuantDirection = 'higher' | 'lower' // HIGHER_IS_BETTER | LOWER_IS_BETTER

export interface QuantIndicator {
  id: string
  level: QuantLevel
  axis: string        // axis_code (WORK/COMP/PROD/EMP/RISK/RECR/PERF/TRNG/COST/ATTD/INFR)
  name: string
  unit: string        // وحدة العرض
  target: number      // الهدف بالقيمة البشريّة (25 = ٢٥٪ · 150000 ريال · 0 حالة)
  direction: QuantDirection
}

export const HR_LEVEL_META: Record<QuantLevel, { labelAr: string; icon: string; freqAr: string }> = {
  strategic:   { labelAr: 'استراتيجي', icon: '🎯', freqAr: 'سنوي' },
  tactical:    { labelAr: 'تكتيكي',    icon: '⚔️', freqAr: 'شهري' },
  operational: { labelAr: 'تشغيلي',    icon: '🧭', freqAr: 'يومي/أسبوعي' },
}

export const HR_QUANT_INDICATORS: QuantIndicator[] = [
  // ─── استراتيجي (9) ──────────────────────────────────────────────
  { id: 'KPI_STR_01', level: 'strategic', axis: 'WORK', name: 'إجمالي تكلفة الموارد البشرية / الإيرادات', unit: '%',   target: 25,     direction: 'lower'  },
  { id: 'KPI_STR_02', level: 'strategic', axis: 'WORK', name: 'معدل التسرب السنوي',                        unit: '%',   target: 10,     direction: 'lower'  },
  { id: 'KPI_STR_03', level: 'strategic', axis: 'WORK', name: 'متوسط سنوات الخبرة',                        unit: 'سنة', target: 3,      direction: 'higher' },
  { id: 'KPI_STR_04', level: 'strategic', axis: 'COMP', name: 'نسبة السعودة الفعلية / المستهدفة',          unit: '%',   target: 100,    direction: 'higher' },
  { id: 'KPI_STR_05', level: 'strategic', axis: 'COMP', name: 'نسبة الامتثال القانوني',                    unit: '%',   target: 90,     direction: 'higher' },
  { id: 'KPI_STR_06', level: 'strategic', axis: 'PROD', name: 'الإيراد لكل موظف',                          unit: 'ريال', target: 150000, direction: 'higher' },
  { id: 'KPI_STR_07', level: 'strategic', axis: 'PROD', name: 'ROI التدريب',                               unit: '%',   target: 150,    direction: 'higher' },
  { id: 'KPI_STR_08', level: 'strategic', axis: 'EMP',  name: 'مؤشر رضا الموظفين (eNPS)',                  unit: 'درجة', target: 50,     direction: 'higher' },
  { id: 'KPI_STR_09', level: 'strategic', axis: 'RISK', name: 'نسبة المخاطر المفتوحة / إجمالي المخاطر',     unit: '%',   target: 5,      direction: 'lower'  },
  // ─── تكتيكي (11) ────────────────────────────────────────────────
  { id: 'KPI_TAC_01', level: 'tactical', axis: 'RECR', name: 'متوسط أيام التعيين',                         unit: 'يوم', target: 14,  direction: 'lower'  },
  { id: 'KPI_TAC_02', level: 'tactical', axis: 'RECR', name: 'معدل الشغور الوظيفي',                        unit: '%',   target: 5,   direction: 'lower'  },
  { id: 'KPI_TAC_03', level: 'tactical', axis: 'RECR', name: 'نسبة الالتزام بميزانية التوظيف',             unit: '%',   target: 95,  direction: 'higher' },
  { id: 'KPI_TAC_04', level: 'tactical', axis: 'PERF', name: 'نسبة الموظفين المقيّمين أداءً ربعياً',       unit: '%',   target: 100, direction: 'higher' },
  { id: 'KPI_TAC_05', level: 'tactical', axis: 'PERF', name: 'نسبة تحقيق الأهداف الفردية (KPIs)',          unit: '%',   target: 85,  direction: 'higher' },
  { id: 'KPI_TAC_06', level: 'tactical', axis: 'TRNG', name: 'ساعات التدريب لكل موظف / الشهر',             unit: 'ساعة', target: 4,   direction: 'higher' },
  { id: 'KPI_TAC_07', level: 'tactical', axis: 'TRNG', name: 'نسبة إكمال الخطط التدريبية',                 unit: '%',   target: 90,  direction: 'higher' },
  { id: 'KPI_TAC_08', level: 'tactical', axis: 'COST', name: 'نسبة الالتزام بموعد الرواتب',                unit: '%',   target: 100, direction: 'higher' },
  { id: 'KPI_TAC_09', level: 'tactical', axis: 'COST', name: 'نسبة الرواتب المنافسة vs السوق',             unit: '%',   target: 90,  direction: 'higher' },
  { id: 'KPI_TAC_10', level: 'tactical', axis: 'ATTD', name: 'معدل الغياب غير المبرر شهرياً',              unit: '%',   target: 2,   direction: 'lower'  },
  { id: 'KPI_TAC_11', level: 'tactical', axis: 'ATTD', name: 'معدل التأخر الصباحي (شهري)',                 unit: '%',   target: 3,   direction: 'lower'  },
  // ─── تشغيلي (11) ────────────────────────────────────────────────
  { id: 'KPI_OPR_01', level: 'operational', axis: 'ATTD', name: 'نسبة الحضور اليومي',                       unit: '%',   target: 98, direction: 'higher' },
  { id: 'KPI_OPR_02', level: 'operational', axis: 'ATTD', name: 'عدد الغيابات غير المبررة هذا الأسبوع',     unit: 'حالة', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_03', level: 'operational', axis: 'ATTD', name: 'عدد حالات التأخر الصباحي اليوم',          unit: 'حالة', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_04', level: 'operational', axis: 'COMP', name: 'إقامات تنتهي خلال 30 يوم',                unit: 'عدد', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_05', level: 'operational', axis: 'COMP', name: 'رخص عمل غير سارية',                        unit: 'عدد', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_06', level: 'operational', axis: 'COMP', name: 'موظفون بدون تأمين صحي',                    unit: 'عدد', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_07', level: 'operational', axis: 'RISK', name: 'شكاوى موظفين مفتوحة (غير محلولة)',         unit: 'عدد', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_08', level: 'operational', axis: 'RISK', name: 'استقالات مفاجئة (آخر 7 أيام)',            unit: 'عدد', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_09', level: 'operational', axis: 'COST', name: 'سلف مستحقة غير مسددة',                     unit: 'عدد', target: 0,  direction: 'lower'  },
  { id: 'KPI_OPR_10', level: 'operational', axis: 'INFR', name: 'آخر نسخة احتياطية للبيانات',              unit: 'يوم', target: 1,  direction: 'lower'  },
  { id: 'KPI_OPR_11', level: 'operational', axis: 'INFR', name: 'عقود غير مسجلة في التأمينات',              unit: 'عدد', target: 0,  direction: 'lower'  },
]

export const HR_QUANT_LEVELS: QuantLevel[] = ['strategic', 'tactical', 'operational']

/** قيَم الأداء الفعليّ التي يُدخلها المدير: id → رقم (أو غير موجود). */
export type QuantActuals = Record<string, number>

export type QuantStatus = 'ok' | 'off' | 'empty'

export interface QuantEval {
  gap: number | null   // فرق موقّع (الفعليّ − الهدف)؛ null إن لم يُدخَل
  status: QuantStatus
}

/** يقيّم مؤشّراً مقابل الأداء الفعليّ حسب اتجاهه. */
export function evalIndicator(ind: QuantIndicator, actual: number | null | undefined): QuantEval {
  if (actual == null || !isFinite(actual)) return { gap: null, status: 'empty' }
  const gap = Math.round((actual - ind.target) * 100) / 100
  const ok = ind.direction === 'higher' ? actual >= ind.target : actual <= ind.target
  return { gap, status: ok ? 'ok' : 'off' }
}

export interface LevelSummary {
  total: number
  entered: number
  ok: number
  off: number
  /** نسبة التحقيق = ضمن الهدف ÷ المُدخَل (٠ إن لم يُدخَل شيء). */
  achievedPct: number
}

export function levelSummary(level: QuantLevel, actuals: QuantActuals): LevelSummary {
  const inds = HR_QUANT_INDICATORS.filter((i) => i.level === level)
  let entered = 0, ok = 0, off = 0
  for (const ind of inds) {
    const e = evalIndicator(ind, actuals[ind.id])
    if (e.status === 'empty') continue
    entered++
    if (e.status === 'ok') ok++
    else off++
  }
  return { total: inds.length, entered, ok, off, achievedPct: entered ? Math.round((ok / entered) * 100) : 0 }
}

// ─── جسر §د: أيّ مؤشّرات تُغذّي محرّك الأثر المالي (LINK_29..33) ──────
export const FINANCIAL_INDICATOR_IDS = {
  turnover: 'KPI_STR_02', // معدل التسرب → turnoverCost
  absence:  'KPI_TAC_10', // الغياب الشهري → absenceImpact
  vacancy:  'KPI_TAC_02', // الشغور → vacancyImpact
  enps:     'KPI_STR_08', // eNPS → enpsImpact
  hrCost:   'KPI_STR_01', // تكلفة HR/الإيراد → hrCostImpact
} as const
