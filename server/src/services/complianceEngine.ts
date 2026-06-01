// Compliance audit engine. Implements:
//   - Basic 8-question maturity scoring
//   - Pro: per-axis maturity across mandatory + sector-contextual axes
//   - Smart KO licenses (expired = forces axis to 0 + penalty)
//   - 4-zone severity engine (green/yellow/orange/red)
//   - 8-row risk matrix (probability × impact)
//   - Saudi penalty estimate per entity size
//   - 12-week reform plan generator targeting the lowest-scoring axes
//
// See plan §5.3.

import type { EntitySize } from '@prisma/client';

import { dangerZoneFor, type DangerZone } from './auditEngine';
import {
  COMPLIANCE_AXES,
  COMPLIANCE_PRO_QUESTIONS,
  KO_LICENSES,
  activeAxesForSector,
  type ComplianceAxisDef,
  type ComplianceAxisKey,
  type ComplianceProQuestion,
} from '../lib/complianceQuestions';
import { MAX_PENALTY_BY_SIZE, PENALTY_AXIS_WEIGHT, PENALTY_CURRENCY } from '../lib/saudiPenalties';

// ─── Basic audit (8 questions, plain Likert 0–3 each) ───────────────────────

export interface ComplianceBasicAnswer {
  questionId: string;
  value: 'none' | 'partial' | 'good' | 'great';
}

const LIKERT_SCORE: Record<ComplianceBasicAnswer['value'], number> = {
  none: 0,
  partial: 1,
  good: 2,
  great: 3,
};

export interface ComplianceBasicResult {
  rawScore: number;
  maxScore: number;
  maturityPct: number;
  dangerZone: DangerZone;
}

export function scoreComplianceBasic(
  questionCount: number,
  answers: ComplianceBasicAnswer[]
): ComplianceBasicResult {
  const raw = answers.reduce((acc, a) => acc + (LIKERT_SCORE[a.value] ?? 0), 0);
  const max = questionCount * 3;
  const maturityPct = max === 0 ? 0 : Math.round((raw / max) * 100);
  const dangerZone = dangerZoneFor(maturityPct);
  return { rawScore: raw, maxScore: max, maturityPct, dangerZone };
}

// ─── Pro audit ──────────────────────────────────────────────────────────────

export interface ComplianceProAnswer {
  questionId: string;
  value: 'none' | 'partial' | 'good' | 'great';
}

export interface KOInput {
  key: string;
  expiresAt: string | null; // ISO date, null = unknown / not applicable
}

export interface AxisScore {
  axis: ComplianceAxisKey;
  label: string;
  regulator: string;
  maturityPct: number;
  dangerZone: DangerZone;
  koFlag: boolean;
  warnings: string[];
}

export interface RiskMatrixRow {
  axis: ComplianceAxisKey;
  label: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  risk: number; // probability × impact
  topRisk: string;
}

export interface ReformAction {
  week: number;
  axis: ComplianceAxisKey;
  action: string;
  owner: string;
}

export interface ComplianceProResult {
  overallMaturityPct: number;
  dangerZone: DangerZone;
  axes: AxisScore[];
  riskMatrix: RiskMatrixRow[];
  penaltyEstimate: {
    currency: string;
    maxPenalty: number;
    estimate: number;
    perAxis: { axis: ComplianceAxisKey; share: number; estimate: number }[];
  };
  reformPlan: ReformAction[];
  koLicenses: { key: string; label: string; daysUntilExpiry: number | null; warning: 'OK' | '90_DAYS' | '30_DAYS' | 'EXPIRED' }[];
}

const ACTIONS_BY_AXIS: Record<ComplianceAxisKey, string[]> = {
  commercial: [
    'احصر كل التراخيص (السجل التجاري، البلدية، الترخيص حسب النشاط) وجدّدها خلال 14 يوماً.',
    'اربط كل التراخيص بتقويم تجديد مع تذكيرات قبل 60/30/7 يوماً من الانتهاء.',
    'حدّد مسؤولاً لكل ترخيص ووثّق نقل المهام لنائب.',
  ],
  tax_zakat: [
    'طابق إقرارات ضريبة القيمة المضافة والزكاة لآخر 12 شهراً، وصحّح أي فجوات بإفصاح اختياري.',
    'فعّل / تحقّق من التكامل مع المرحلة الثانية للفاتورة الإلكترونية (فاتورة).',
    'نفّذ مراجعة جاهزية لأسعار التحويل.',
  ],
  labor_saudization: [
    'وحّد عقود قوى مع رواتب مدد وتسجيل التأمينات لكل موظف نشط.',
    'تحقّق من حماية الأجور (WPS) لآخر دورة رواتب.',
    'ضع خطة 90 يوماً للوصول للنطاق المستهدف من نطاقات.',
  ],
  data_privacy: [
    'أنجز رسم خرائط بيانات PDPL وانشر إشعار الخصوصية.',
    'فعّل آليات الموافقة، الإبلاغ عن الاختراق، وحقوق أصحاب البيانات.',
    'عيّن مسؤول حماية البيانات وحدّد تقييمات النقل عبر الحدود.',
  ],
  cybersecurity: [
    'نفّذ تقييم فجوة على ضوابط الأمن السيبراني الأساسية (ECC) للهيئة الوطنية.',
    'حدّث الأصول الحرجة، فرض MFA لكل حسابات الإدارة، اختبر النسخ الاحتياطية.',
    'تدرّب على خطة الاستجابة للحوادث بتمرين طاولة.',
  ],
  corporate_gov: [
    'أعدّ / حدّث ميثاق مجلس الإدارة، التفويضات، وإقرارات تعارض المصالح.',
    'فعّل قناة الإبلاغ عن المخالفات ووثّق سياسة المعاملات مع الأطراف ذات العلاقة.',
    'اعتمد دورة مراجعة فصلية لسجل المخاطر.',
  ],
  aml_kyc: [
    'وثّق سياسة مكافحة غسل الأموال وتمويل الإرهاب وتقييم المخاطر.',
    'فعّل KYC، فحص العقوبات / الأشخاص ذوي النفوذ، والإبلاغ عن المعاملات المشبوهة.',
    'نفّذ تدريب AML إلزامي وسجّل الحضور لكل دور ذي علاقة.',
  ],
  consumer_protection: [
    'انشر الشروط والأحكام والاسترداد وقناة الشكاوى بالعربية.',
    'دقّق صفحات الأسعار لشمولها ضريبة القيمة المضافة، وادعاءات التسويق الدقيقة.',
    'حدّد شروط الضمان واتفاقيات مستوى خدمة ما بعد البيع.',
  ],
  health_safety: ['نفّذ تقييم مخاطر السلامة والصحة المهنية وخطة إجراءات تصحيحية.', 'درّب كل الأدوار الأمامية على السلامة.', 'وثّق الإبلاغ عن الحوادث الوشيكة.'],
  environment: ['اربط الالتزامات البيئية بتصاريح المركز الوطني للالتزام البيئي.', 'تابع مؤشرات الانبعاثات / النفايات شهرياً.', 'خطّط لتدقيق بيئي.'],
  food_safety: ['تحقّق من تصاريح هيئة الغذاء والدواء وتتبّع التشغيلات.', 'فعّل خطة HACCP.', 'درّب كل المتعاملين مع الأغذية.'],
  medical_devices: ['تحقّق من تسجيلات الأجهزة الطبية مع SFDA والرقابة بعد التسويق.', 'وثّق UDI والملصقات.', 'نفّذ تمرين استدعاء.'],
  pharma: ['تحقّق من تصاريح الأدوية / مستحضرات التجميل ويقظة الأدوية.', 'دقّق عمليات GMP / GDP.', 'درّب الموظفين على الإبلاغ عن الأحداث الضارة.'],
  banking_sama: ['اربط الالتزامات مع ساما وكفاية رأس المال.', 'اختبر خطة استمرارية الأعمال وسيناريوهات الضغط.', 'راجع سجل التعهيد.'],
  capital_markets_cma: ['تحقّق من التزامات ترخيص هيئة السوق المالية.', 'أحكم ضوابط التداول الداخلي والإفصاحات.', 'حدّث عملية ملاءمة العميل.'],
  telecom_cst: ['تحقّق من تراخيص هيئة الاتصالات والامتثال للطيف الترددي.', 'دقّق الربط البيني / جودة الخدمة.', 'حدّث شروط العميل.'],
  construction_safety: ['تحقّق من الالتزام بكود البناء السعودي وتصاريح الموقع.', 'نفّذ تدقيقات سلامة الموقع.', 'دقّق التزام المقاولين.'],
  export_import_customs: ['طابق إقرارات الاستيراد / التصدير مع جمارك زاتكا.', 'دقّق التصنيفات الجمركية (HS).', 'راجع الأهلية للمنطقة الحرة / AEO.'],
};

const TOP_RISK_BY_AXIS: Record<ComplianceAxisKey, string> = {
  commercial: 'انتهاء الترخيص يؤدي لإغلاق إجباري',
  tax_zakat: 'تقدير ضريبة القيمة المضافة / الزكاة + غرامات',
  labor_saudization: 'تراجع نطاقات يعطّل التأشيرات',
  data_privacy: 'اختراق نظام حماية البيانات + ضرر سمعة',
  cybersecurity: 'حادث سيبراني + عدم امتثال ECC',
  corporate_gov: 'مسؤولية أعضاء مجلس الإدارة + نزاع مساهمين',
  aml_kyc: 'مخالفة AML + إجراء تنظيمي',
  consumer_protection: 'دعوى جماعية / غرامة وزارة التجارة',
  health_safety: 'إصابة عامل + إجراء تنظيمي',
  environment: 'غرامة بيئية + إيقاف مشروع',
  food_safety: 'استدعاء + إجراء SFDA',
  medical_devices: 'استدعاء + سحب من السوق',
  pharma: 'مخالفة يقظة الأدوية',
  banking_sama: 'إجراء إنفاذ من ساما',
  capital_markets_cma: 'غرامة CMA + تعليق ترخيص',
  telecom_cst: 'غرامة CST + خطر ترخيص',
  construction_safety: 'إيقاف موقع + حادث سلامة',
  export_import_customs: 'تقدير جمركي + حجز',
};

function avgScoreForAxis(axisKey: ComplianceAxisKey, answers: ComplianceProAnswer[]): { raw: number; rawMax: number } {
  const qs = COMPLIANCE_PRO_QUESTIONS.filter((q) => q.axis === axisKey);
  const byId = new Map(answers.map((a) => [a.questionId, a] as const));
  let raw = 0;
  for (const q of qs) {
    const ans = byId.get(q.id);
    raw += ans ? LIKERT_SCORE[ans.value] : 0;
  }
  return { raw, rawMax: qs.length * 3 };
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function koWarning(days: number | null): 'OK' | '90_DAYS' | '30_DAYS' | 'EXPIRED' {
  if (days == null) return 'OK';
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return '30_DAYS';
  if (days <= 90) return '90_DAYS';
  return 'OK';
}

export interface ComplianceProInput {
  sector?: string;
  entitySize: EntitySize;
  answers: ComplianceProAnswer[];
  koLicenses?: KOInput[];
}

export function scoreCompliancePro(input: ComplianceProInput): ComplianceProResult {
  const activeAxes = activeAxesForSector(input.sector);

  // KO licenses — map by axis.
  const koByAxis = new Map<ComplianceAxisKey, { key: string; label: string; daysUntilExpiry: number | null; warning: ReturnType<typeof koWarning> }[]>();
  const koAll: ComplianceProResult['koLicenses'] = [];
  for (const lic of KO_LICENSES) {
    if (lic.appliesWhen === 'sector' && (!input.sector || !lic.sectors?.includes(input.sector.toLowerCase()))) continue;
    const ko = input.koLicenses?.find((k) => k.key === lic.key);
    const days = daysUntil(ko?.expiresAt ?? null);
    const warning = koWarning(days);
    const row = { key: lic.key, label: lic.label, daysUntilExpiry: days, warning };
    koAll.push(row);
    const arr = koByAxis.get(lic.axis) ?? [];
    arr.push(row);
    koByAxis.set(lic.axis, arr);
  }

  const axes: AxisScore[] = activeAxes.map((axis) => {
    const { raw, rawMax } = avgScoreForAxis(axis.key, input.answers);
    const expired = (koByAxis.get(axis.key) ?? []).some((k) => k.warning === 'EXPIRED');
    const warning30 = (koByAxis.get(axis.key) ?? []).some((k) => k.warning === '30_DAYS' || k.warning === 'EXPIRED');
    const warning90 = (koByAxis.get(axis.key) ?? []).some((k) => k.warning === '90_DAYS');
    let maturityPct = rawMax === 0 ? 0 : Math.round((raw / rawMax) * 100);
    if (expired) maturityPct = 0;
    const dangerZone = dangerZoneFor(maturityPct);
    const warnings: string[] = [];
    if (expired) warnings.push('Critical license expired — axis forced to 0');
    else if (warning30) warnings.push('License expires within 30 days');
    else if (warning90) warnings.push('License expires within 90 days');
    return {
      axis: axis.key,
      label: axis.label,
      regulator: axis.regulator,
      maturityPct,
      dangerZone,
      koFlag: expired,
      warnings,
    };
  });

  const overallMaturityPct = axes.length === 0 ? 0 : Math.round(axes.reduce((s, a) => s + a.maturityPct, 0) / axes.length);
  const dangerZone = dangerZoneFor(overallMaturityPct);

  // Risk matrix — derive probability/impact from maturity. Pick 8 rows.
  const matrix: RiskMatrixRow[] = [...axes]
    .sort((a, b) => a.maturityPct - b.maturityPct)
    .slice(0, 8)
    .map((a) => {
      const probability = (a.maturityPct >= 80 ? 1 : a.maturityPct >= 60 ? 2 : a.maturityPct >= 40 ? 3 : a.maturityPct >= 20 ? 4 : 5) as 1 | 2 | 3 | 4 | 5;
      const impact: 1 | 2 | 3 | 4 | 5 = mandatoryImpact(a.axis);
      return {
        axis: a.axis,
        label: a.label,
        probability,
        impact,
        risk: probability * impact,
        topRisk: TOP_RISK_BY_AXIS[a.axis],
      };
    });

  // Penalty estimate — scaled by risk share of lowest-scoring mandatory axes.
  const maxPenalty = MAX_PENALTY_BY_SIZE[input.entitySize];
  const perAxis = axes
    .filter((a) => COMPLIANCE_AXES.find((d) => d.key === a.axis)?.mandatory)
    .map((a) => {
      const share = PENALTY_AXIS_WEIGHT[a.axis] ?? 0;
      const riskFactor = (100 - a.maturityPct) / 100;
      const estimate = Math.round(maxPenalty * share * riskFactor);
      return { axis: a.axis, share, estimate };
    });
  const estimate = perAxis.reduce((s, x) => s + x.estimate, 0);

  // Reform plan — 12-week walking schedule, two actions/week, weakest axes first.
  const sortedWeak = [...axes].sort((a, b) => a.maturityPct - b.maturityPct);
  const planActions: ReformAction[] = [];
  let week = 1;
  for (const axis of sortedWeak) {
    const actions = ACTIONS_BY_AXIS[axis.axis] ?? [];
    for (const action of actions) {
      if (week > 12) break;
      planActions.push({ week, axis: axis.axis, action, owner: `${axis.label} owner` });
      week += 1;
    }
    if (week > 12) break;
  }

  return {
    overallMaturityPct,
    dangerZone,
    axes,
    riskMatrix: matrix,
    penaltyEstimate: { currency: PENALTY_CURRENCY, maxPenalty, estimate, perAxis },
    reformPlan: planActions,
    koLicenses: koAll,
  };
}

// Mandatory axes carry impact = 5; contextual axes impact = 4.
function mandatoryImpact(axisKey: ComplianceAxisKey): 1 | 2 | 3 | 4 | 5 {
  return COMPLIANCE_AXES.find((d) => d.key === axisKey)?.mandatory ? 5 : 4;
}

export type { ComplianceAxisDef, ComplianceAxisKey, ComplianceProQuestion };
