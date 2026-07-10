// ─── مركز ذكاء KPIs — توليد مؤشرات ذكية بناءً على السياق ────────────
// المصدر: بنك مؤشرات جاهز حسب التخصّص + قواعد ذكاء تتغذّى من:
//   • Company.opex   — الميزانية والمستهدف يُحدّدان قيم KPI الرقمية
//   • user.pains     — الآلام تُشغّل KPIs مطابقة (مثال: no_kpis → أضِف قياس)
//   • user.goals     — الأهداف تُشغّل KPIs مطابقة
//   • آخر تدقيق      — نقاط الضعف تُوَلِّد KPIs متعلّقة
//
// كل مقترح يحوي rationale واضح ولايُعرض بلا سبب معروف. المستخدم يضغط زر
// «أضف إلى القاعدة» → يُنشأ KPI حقيقي عبر createKPI (لا يبقى في الذاكرة).

import type { DeptCode } from './deptApi'
import type { OpexData, PainCode, GoalCode } from '@/types/user'

export interface SmartKPISuggestion {
  key: string           // معرّف مستقر (لتفادي التكرار)
  name: string
  unit: string
  targetValue: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  rationale: string
  source: 'specialty' | 'opex' | 'pain' | 'goal' | 'audit'
}

interface Context {
  specialty: DeptCode | null
  opex: OpexData
  pains: string[]
  goals: string[]
  auditHealthPct: number | null  // 0..100 (لو موجود)
}

// ─── بنك المؤشرات الأساسي حسب التخصّص ───────────────────────────
// لكل KPI: قيمة افتراضية معقولة + وحدة + تكرار.
const SPECIALTY_KPIS: Partial<Record<DeptCode, SmartKPISuggestion[]>> = {
  HR: [
    { key: 'hr_turnover',   name: 'معدل الدوران السنوي',   unit: '%', targetValue: 10,  frequency: 'annual',    rationale: 'معيار قطاعي: 10-15% مقبول.', source: 'specialty' },
    { key: 'hr_saudization', name: 'نسبة السعودة',          unit: '%', targetValue: 35,  frequency: 'quarterly', rationale: 'نطاقات نطاقات — يختلف حسب الحجم والقطاع.', source: 'specialty' },
    { key: 'hr_satisfaction', name: 'مؤشر رضا الموظفين',    unit: '%', targetValue: 75,  frequency: 'annual',    rationale: 'استبيان eNPS — 75%+ عالي.', source: 'specialty' },
    { key: 'hr_hire_time', name: 'زمن التوظيف',            unit: 'يوم', targetValue: 45, frequency: 'quarterly', rationale: 'قياسي: 30-60 يوم.', source: 'specialty' },
  ],
  FINANCE: [
    { key: 'fin_net_margin', name: 'هامش صافي',             unit: '%',    targetValue: 15, frequency: 'quarterly', rationale: 'مؤشر الربحية الأساسي.', source: 'specialty' },
    { key: 'fin_dso',        name: 'DSO — فترة التحصيل',    unit: 'يوم',  targetValue: 45, frequency: 'monthly',   rationale: 'كل يوم إضافي = زيادة رأس مال عامل.', source: 'specialty' },
    { key: 'fin_current',    name: 'نسبة السيولة الجارية',  unit: 'ضعف',  targetValue: 2,  frequency: 'quarterly', rationale: 'قدرة على الوفاء قصير الأمد.', source: 'specialty' },
    { key: 'fin_report_days', name: 'أيام إغلاق الشهر',    unit: 'يوم', targetValue: 5,  frequency: 'monthly',   rationale: 'سرعة إقفال الحسابات.', source: 'specialty' },
  ],
  SALES: [
    { key: 'sal_conversion', name: 'معدل التحويل',           unit: '%',    targetValue: 25, frequency: 'monthly',   rationale: 'من فرصة إلى صفقة.', source: 'specialty' },
    { key: 'sal_cycle',      name: 'دورة البيع',             unit: 'يوم',  targetValue: 60, frequency: 'quarterly', rationale: 'قصر الدورة = تسريع النقد.', source: 'specialty' },
    { key: 'sal_ltv_cac',    name: 'LTV/CAC',                unit: 'ضعف',  targetValue: 3,  frequency: 'quarterly', rationale: '3+ عادةً صحّي.', source: 'specialty' },
    { key: 'sal_pipeline',   name: 'قيمة الأنبوب النشط',    unit: 'ر.س',   targetValue: 1_000_000, frequency: 'monthly', rationale: 'مبالغ الفرص المفتوحة.', source: 'specialty' },
  ],
  MARKETING: [
    { key: 'mkt_roas',      name: 'ROAS',                    unit: 'ضعف', targetValue: 4,  frequency: 'monthly',   rationale: 'كل ريال إنفاق = 4 ريال إيراد.', source: 'specialty' },
    { key: 'mkt_cac',       name: 'CAC — تكلفة اكتساب',      unit: 'ر.س', targetValue: 300, frequency: 'monthly',   rationale: 'أقل من ثلث LTV.', source: 'specialty' },
    { key: 'mkt_leads',     name: 'MQLs الشهرية',            unit: 'عدد', targetValue: 200, frequency: 'monthly',   rationale: 'حجم أنبوب التسويق.', source: 'specialty' },
    { key: 'mkt_engagement', name: 'معدل التفاعل',           unit: '%',   targetValue: 5,  frequency: 'weekly',    rationale: 'قناة اجتماعية.', source: 'specialty' },
  ],
  OPERATIONS: [
    { key: 'ops_oee',       name: 'OEE — كفاءة إجمالية',    unit: '%',    targetValue: 75, frequency: 'weekly',    rationale: 'المعيار عالمياً 85%+.', source: 'specialty' },
    { key: 'ops_cycle',     name: 'زمن دورة العملية',       unit: 'دقيقة', targetValue: 30, frequency: 'weekly',    rationale: 'كل تقليل = كفاءة أعلى.', source: 'specialty' },
    { key: 'ops_defect',    name: 'معدل العيوب',            unit: '%',    targetValue: 2,  frequency: 'daily',     rationale: 'أقل من 2% صحّي.', source: 'specialty' },
  ],
  IT: [
    { key: 'it_uptime',     name: 'Uptime',                  unit: '%', targetValue: 99.5, frequency: 'monthly',   rationale: 'معيار SaaS 99.9%+.', source: 'specialty' },
    { key: 'it_mttr',       name: 'MTTR — زمن الإصلاح',     unit: 'ساعة', targetValue: 4,  frequency: 'monthly',   rationale: 'قصر MTTR = تعافي أسرع.', source: 'specialty' },
    { key: 'it_sla',        name: 'التزام SLA',              unit: '%', targetValue: 95,   frequency: 'monthly',   rationale: 'من العقود مع الأعمال.', source: 'specialty' },
    { key: 'it_tickets',    name: 'تذاكر تُحلّ خلال 24 س',   unit: '%', targetValue: 90,   frequency: 'weekly',    rationale: 'قدرة الدعم.', source: 'specialty' },
  ],
  CUSTOMER_SERVICE: [
    { key: 'cs_fcr',        name: 'FCR — حل من أول مرة',    unit: '%',    targetValue: 70, frequency: 'monthly',   rationale: 'كل +5% = تقليل تكرار.', source: 'specialty' },
    { key: 'cs_csat',       name: 'CSAT',                    unit: '%',    targetValue: 85, frequency: 'monthly',   rationale: 'رضا العملاء.', source: 'specialty' },
    { key: 'cs_response',   name: 'زمن الاستجابة الأول',    unit: 'دقيقة', targetValue: 15, frequency: 'weekly',    rationale: 'زمن الرد الأوّل.', source: 'specialty' },
    { key: 'cs_nps',        name: 'NPS',                     unit: 'رقم', targetValue: 50, frequency: 'quarterly', rationale: '50+ ممتاز.', source: 'specialty' },
  ],
  SUPPORT: [
    { key: 'sup_sla',       name: 'التزام SLA للدعم',       unit: '%',   targetValue: 95,  frequency: 'monthly',   rationale: 'كفاءة الدعم.', source: 'specialty' },
    { key: 'sup_procure',   name: 'دورة الشراء',            unit: 'يوم', targetValue: 21,  frequency: 'monthly',   rationale: 'من الطلب للتوريد.', source: 'specialty' },
  ],
  LOGISTICS: [
    { key: 'log_otif',      name: 'OTIF — تسليم في الموعد',  unit: '%',    targetValue: 95, frequency: 'weekly',    rationale: 'المعيار الذهبي.', source: 'specialty' },
    { key: 'log_cost',      name: 'تكلفة الشحن/طلب',         unit: 'ر.س', targetValue: 30, frequency: 'monthly',   rationale: 'كفاءة اللوجستيات.', source: 'specialty' },
    { key: 'log_accuracy',  name: 'دقة التسليم',             unit: '%',    targetValue: 99, frequency: 'weekly',    rationale: 'خفض التكاليف.', source: 'specialty' },
  ],
  QUALITY: [
    { key: 'qua_defect',    name: 'معدل العيوب',             unit: '%',   targetValue: 1,  frequency: 'weekly',    rationale: 'أقل من 1% صحّي.', source: 'specialty' },
    { key: 'qua_rework',    name: 'نسبة إعادة العمل',        unit: '%',   targetValue: 3,  frequency: 'weekly',    rationale: 'مؤشر النضج.', source: 'specialty' },
    { key: 'qua_complaints', name: 'شكاوى الجودة الشهرية',   unit: 'عدد', targetValue: 5,  frequency: 'monthly',   rationale: 'صوت العميل.', source: 'specialty' },
  ],
  PROJECTS: [
    { key: 'proj_ontime',   name: 'التسليم في الموعد',       unit: '%',    targetValue: 90, frequency: 'monthly',   rationale: 'الأداء المشروعي.', source: 'specialty' },
    { key: 'proj_budget',   name: 'الالتزام بالميزانية',    unit: '%',    targetValue: 95, frequency: 'monthly',   rationale: 'انحراف < 5%.', source: 'specialty' },
    { key: 'proj_scope',    name: 'انزلاق النطاق',           unit: '%',    targetValue: 10, frequency: 'quarterly', rationale: 'أقل = أفضل.', source: 'specialty' },
  ],
  COMPLIANCE: [
    { key: 'com_score',     name: 'درجة التدقيق',            unit: '%', targetValue: 90, frequency: 'quarterly', rationale: 'مستوى الالتزام العام.', source: 'specialty' },
    { key: 'com_avoid',     name: 'الغرامات المتجنّبة',      unit: 'ر.س', targetValue: 100_000, frequency: 'annual',    rationale: 'قيمة الوقاية.', source: 'specialty' },
    { key: 'com_zatca',     name: 'التزام ZATCA',            unit: '%', targetValue: 100, frequency: 'monthly',   rationale: 'صفر مخالفات.', source: 'specialty' },
  ],
  GOVERNANCE: [
    { key: 'gov_meetings',  name: 'حضور مجلس الإدارة',       unit: '%',    targetValue: 90, frequency: 'quarterly', rationale: 'انخراط الأعضاء.', source: 'specialty' },
    { key: 'gov_risks',     name: 'مخاطر مُخفَّفة',          unit: '%',    targetValue: 80, frequency: 'quarterly', rationale: 'من إجمالي السجل.', source: 'specialty' },
  ],
}

// ─── قواعد ذكاء تُضيف/تُعدّل KPIs حسب السياق ─────────────────────
export function generateSmartKPIs(ctx: Context): SmartKPISuggestion[] {
  const out: SmartKPISuggestion[] = []
  const seen = new Set<string>()

  const addUnique = (kpi: SmartKPISuggestion) => {
    if (seen.has(kpi.key)) return
    seen.add(kpi.key)
    out.push(kpi)
  }

  // 1) البنك الأساسي حسب التخصّص.
  if (ctx.specialty) {
    for (const kpi of SPECIALTY_KPIS[ctx.specialty] ?? []) {
      addUnique(kpi)
    }
  }

  // 2) قواعد OPEX: لو المستهدف السنوي محدّد → أضِف KPI إيراد شهري.
  if (ctx.opex.target && ctx.opex.target > 0) {
    addUnique({
      key: 'opex_monthly_revenue',
      name: 'الإيراد الشهري',
      unit: 'ر.س',
      targetValue: Math.round(ctx.opex.target / 12),
      frequency: 'monthly',
      rationale: `مشتقّ من المستهدف السنوي (${ctx.opex.target.toLocaleString('ar-SA')} ر.س ÷ ١٢).`,
      source: 'opex',
    })
  }
  if (ctx.opex.budget && ctx.opex.target && ctx.opex.budget > 0) {
    addUnique({
      key: 'opex_roi',
      name: 'العائد على الإنفاق (ROI)',
      unit: 'ضعف',
      targetValue: Number((ctx.opex.target / ctx.opex.budget).toFixed(1)),
      frequency: 'quarterly',
      rationale: `مستهدف/ميزانية = ${(ctx.opex.target / ctx.opex.budget).toFixed(1)}×.`,
      source: 'opex',
    })
  }
  if (ctx.opex.team && ctx.opex.target && ctx.opex.team > 0) {
    addUnique({
      key: 'opex_revenue_per_head',
      name: 'الإيراد لكل عضو فريق',
      unit: 'ر.س',
      targetValue: Math.round(ctx.opex.target / ctx.opex.team),
      frequency: 'quarterly',
      rationale: `المستهدف ÷ عدد الفريق (${ctx.opex.team}) = ${Math.round(ctx.opex.target / ctx.opex.team).toLocaleString('ar-SA')} ر.س/عضو.`,
      source: 'opex',
    })
  }

  // 3) قواعد الآلام.
  const painsSet = new Set(ctx.pains as PainCode[])
  if (painsSet.has('no_kpis')) {
    addUnique({
      key: 'pain_kpi_coverage',
      name: 'نسبة تغطية المؤشرات',
      unit: '%',
      targetValue: 80,
      frequency: 'quarterly',
      rationale: 'اخترت «لا مؤشرات واضحة» — ابدأ بقياس التغطية نفسها.',
      source: 'pain',
    })
  }
  if (painsSet.has('no_data')) {
    addUnique({
      key: 'pain_data_completeness',
      name: 'اكتمال البيانات',
      unit: '%',
      targetValue: 90,
      frequency: 'monthly',
      rationale: 'اخترت «بلا بيانات موثوقة» — قِس نضج البيانات.',
      source: 'pain',
    })
  }
  if (painsSet.has('no_alignment')) {
    addUnique({
      key: 'pain_okr_completion',
      name: 'اكتمال OKRs الربعية',
      unit: '%',
      targetValue: 70,
      frequency: 'quarterly',
      rationale: 'اخترت «لا مواءمة بين الأقسام» — OKRs توحّد الاتجاه.',
      source: 'pain',
    })
  }
  if (painsSet.has('team_lost')) {
    addUnique({
      key: 'pain_role_clarity',
      name: 'وضوح الأدوار (استبيان)',
      unit: '%',
      targetValue: 85,
      frequency: 'quarterly',
      rationale: 'اخترت «الفريق تائه» — استبيان دوري للفريق.',
      source: 'pain',
    })
  }

  // 4) قواعد الأهداف.
  const goalsSet = new Set(ctx.goals as GoalCode[])
  if (goalsSet.has('reports')) {
    addUnique({
      key: 'goal_reporting_cadence',
      name: 'التزام دورة التقارير',
      unit: '%',
      targetValue: 100,
      frequency: 'monthly',
      rationale: 'اخترت «تقارير أوضح للإدارة» — التزم بالجدول.',
      source: 'goal',
    })
  }
  if (goalsSet.has('team')) {
    addUnique({
      key: 'goal_training_hours',
      name: 'ساعات التدريب/موظف',
      unit: 'ساعة',
      targetValue: 20,
      frequency: 'quarterly',
      rationale: 'اخترت «تطوير الفريق» — استثمار مدروس.',
      source: 'goal',
    })
  }

  // 5) قواعد التدقيق: لو الصحة < 60% → أضِف KPI صحة الإدارة نفسها.
  if (ctx.auditHealthPct != null && ctx.auditHealthPct < 60) {
    addUnique({
      key: 'audit_health_pct',
      name: 'صحة الإدارة',
      unit: '%',
      targetValue: Math.min(85, Math.max(70, Math.round(ctx.auditHealthPct + 20))),
      frequency: 'quarterly',
      rationale: `آخر تدقيق ${Math.round(ctx.auditHealthPct)}% — استهدف زيادة تدريجية.`,
      source: 'audit',
    })
  }

  return out
}

// ─── رؤى ذكية جاهزة ─────────────────────────────────────────────
export interface SmartInsight {
  severity: 'info' | 'warning' | 'critical' | 'positive'
  title: string
  detail: string
  source: string
}

export function generateSmartInsights(ctx: Context): SmartInsight[] {
  const out: SmartInsight[] = []

  // OPEX ناقص.
  if (!ctx.opex.target) {
    out.push({
      severity: 'warning',
      title: 'لا مستهدف سنوي محفوظ',
      detail: 'بدون المستهدف لا نستطيع اقتراح KPI الإيراد الشهري ولا حساب ROI. أضِفه من /onboarding.',
      source: 'opex',
    })
  }
  if (!ctx.opex.team) {
    out.push({
      severity: 'info',
      title: 'لا حجم فريق محفوظ',
      detail: 'حجم الفريق يُغذّي RACI و توزيع KPIs. أضِفه من /onboarding.',
      source: 'opex',
    })
  }

  // آلام تدفع نحو أدوات معيّنة.
  const painsSet = new Set(ctx.pains as PainCode[])
  if (painsSet.has('no_kpis')) {
    out.push({
      severity: 'critical',
      title: 'اخترت «لا مؤشرات واضحة»',
      detail: 'ابدأ بحفظ ٣-٥ KPIs جوهرية من القائمة المقترحة أدناه.',
      source: 'pain',
    })
  }
  if (painsSet.has('no_budget') && ctx.opex.budget) {
    out.push({
      severity: 'warning',
      title: 'ألم «ميزانية ضيّقة» + ميزانية محفوظة',
      detail: `ميزانيتك ${ctx.opex.budget.toLocaleString('ar-SA')} ر.س — راقب ROI بدقة (KPI مقترح).`,
      source: 'pain',
    })
  }

  // صحة تدقيق منخفضة.
  if (ctx.auditHealthPct != null) {
    if (ctx.auditHealthPct >= 80) {
      out.push({
        severity: 'positive',
        title: `صحة إدارة عالية (${Math.round(ctx.auditHealthPct)}%)`,
        detail: 'انتقل إلى تحليل استراتيجي أعمق (SWOT ← TOWS ← Directions).',
        source: 'audit',
      })
    } else if (ctx.auditHealthPct < 40) {
      out.push({
        severity: 'critical',
        title: `صحة إدارة منخفضة (${Math.round(ctx.auditHealthPct)}%)`,
        detail: 'الأولوية القصوى: افتح «الخطة الاستراتيجية» — سيولّد لك خطة عاجلة ٩٠ يوماً.',
        source: 'audit',
      })
    }
  } else {
    out.push({
      severity: 'info',
      title: 'لم يُجرَ تدقيق بعد',
      detail: 'التدقيق الأساسي (١٢-١٥ سؤالاً) يفتح باقي التحليلات. ابدأ من صفحة تدقيق التخصّص.',
      source: 'audit',
    })
  }

  return out
}
