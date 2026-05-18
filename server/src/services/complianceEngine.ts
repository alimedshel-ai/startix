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
    'Inventory and renew every license (CR, Baladi, activity-specific) within 14 days.',
    'Map all licenses to a renewal calendar with reminders 60/30/7 days before expiry.',
    'Designate an owner for each license; document hand-over to a deputy.',
  ],
  tax_zakat: [
    'Reconcile last 12 months of VAT and Zakat filings; correct any gaps via voluntary disclosure.',
    'Implement / verify e-invoicing (Fatoora) phase-2 integration.',
    'Run a transfer-pricing readiness review.',
  ],
  labor_saudization: [
    'Align Qiwa contracts, Mudad payroll and GOSI registrations for every active employee.',
    'Validate WPS salary protection for the most recent payroll cycle.',
    'Plot a 90-day Nitaqat plan to reach / hold the targeted band.',
  ],
  data_privacy: [
    'Complete a PDPL data-mapping exercise and publish a privacy notice.',
    'Stand up consent capture, breach notification and data-subject-rights processes.',
    'Appoint a DPO (or equivalent) and define cross-border transfer assessments.',
  ],
  cybersecurity: [
    'Run a gap assessment against the NCA Essential Cybersecurity Controls (ECC).',
    'Patch critical assets, enforce MFA on all admin accounts, test backups.',
    'Rehearse the incident-response plan with a table-top exercise.',
  ],
  corporate_gov: [
    'Draft / refresh board charter, delegations and conflict-of-interest declarations.',
    'Stand up a whistleblower channel and document the related-party transactions policy.',
    'Adopt a quarterly risk-register review cadence.',
  ],
  aml_kyc: [
    'Document the AML / CFT policy and risk assessment.',
    'Operationalize KYC, sanctions / PEP screening and STR reporting.',
    'Run mandatory AML training and capture attendance for every relevant role.',
  ],
  consumer_protection: [
    'Publish Arabic terms & conditions, refund policy and complaint channel.',
    'Audit pricing pages for VAT-inclusive display and accurate marketing claims.',
    'Define warranty terms and after-sale support SLAs.',
  ],
  health_safety: ['Conduct an OSH risk assessment and corrective-action plan.', 'Run safety training for every front-line role.', 'Document near-miss reporting.'],
  environment: ['Map environmental obligations to NCEC permits.', 'Track emissions / waste KPIs monthly.', 'Plan an environmental audit.'],
  food_safety: ['Verify SFDA permits and lot traceability.', 'Implement HACCP plan.', 'Train all handlers.'],
  medical_devices: ['Verify SFDA device registrations and post-market surveillance.', 'Document UDI and labeling.', 'Run mock recall.'],
  pharma: ['Verify SFDA pharma / cosmetics permits and pharmacovigilance.', 'Audit GMP / GDP processes.', 'Train staff on adverse-event reporting.'],
  banking_sama: ['Map SAMA obligations and capital adequacy.', 'Test BCP and stress scenarios.', 'Review outsourcing register.'],
  capital_markets_cma: ['Verify CMA license obligations.', 'Tighten insider-trading controls and disclosures.', 'Refresh client suitability process.'],
  telecom_cst: ['Verify CST licenses and spectrum compliance.', 'Audit interconnection / quality-of-service.', 'Refresh customer terms.'],
  construction_safety: ['Verify Saudi Building Code adherence and site permits.', 'Run site safety audits.', 'Audit contractor compliance.'],
  export_import_customs: ['Reconcile import / export declarations with ZATCA Customs.', 'Audit HS classifications.', 'Review free-zone / AEO eligibility.'],
};

const TOP_RISK_BY_AXIS: Record<ComplianceAxisKey, string> = {
  commercial: 'License expiry causing forced closure',
  tax_zakat: 'VAT / Zakat assessment + penalties',
  labor_saudization: 'Nitaqat downgrade blocking visas',
  data_privacy: 'PDPL breach + reputational damage',
  cybersecurity: 'Cyber incident + ECC non-compliance',
  corporate_gov: 'Director liability + shareholder dispute',
  aml_kyc: 'AML breach + regulatory action',
  consumer_protection: 'Class action / MCI fine',
  health_safety: 'Worker injury + regulatory action',
  environment: 'Environmental fine + project halt',
  food_safety: 'Recall + SFDA action',
  medical_devices: 'Recall + market withdrawal',
  pharma: 'Pharmacovigilance breach',
  banking_sama: 'SAMA enforcement action',
  capital_markets_cma: 'CMA fine + license suspension',
  telecom_cst: 'CST fine + license risk',
  construction_safety: 'Site shutdown + safety incident',
  export_import_customs: 'Customs assessment + seizure',
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
