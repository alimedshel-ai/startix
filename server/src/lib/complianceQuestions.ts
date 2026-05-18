// Compliance audit (Pro) — 64 mandatory elements across 8 axes, plus a
// contextual layer of up to 10 sector-specific axes activated when a sector
// is provided. See plan §5.3.

import type { DeptQuestion } from './deptQuestions';

export type ComplianceAxisKey =
  // 8 mandatory axes
  | 'commercial'
  | 'tax_zakat'
  | 'labor_saudization'
  | 'data_privacy'
  | 'cybersecurity'
  | 'corporate_gov'
  | 'aml_kyc'
  | 'consumer_protection'
  // 10 contextual axes
  | 'health_safety'
  | 'environment'
  | 'food_safety'
  | 'medical_devices'
  | 'pharma'
  | 'banking_sama'
  | 'capital_markets_cma'
  | 'telecom_cst'
  | 'construction_safety'
  | 'export_import_customs';

export interface ComplianceAxisDef {
  key: ComplianceAxisKey;
  label: string;
  regulator: string;
  mandatory: boolean;
  /** Sectors that activate this axis. Mandatory axes are always active. */
  sectors?: string[];
}

export const COMPLIANCE_AXES: ComplianceAxisDef[] = [
  // 8 mandatory
  { key: 'commercial',          label: 'Commercial & licensing',           regulator: 'MCI / MoMRAH',         mandatory: true },
  { key: 'tax_zakat',            label: 'Tax & Zakat',                      regulator: 'ZATCA',                mandatory: true },
  { key: 'labor_saudization',    label: 'Labor & Saudization',              regulator: 'MHRSD / GOSI',         mandatory: true },
  { key: 'data_privacy',         label: 'Data privacy (PDPL)',              regulator: 'SDAIA',                mandatory: true },
  { key: 'cybersecurity',        label: 'Cybersecurity (ECC)',              regulator: 'NCA',                  mandatory: true },
  { key: 'corporate_gov',        label: 'Corporate governance',             regulator: 'MoC / CMA',            mandatory: true },
  { key: 'aml_kyc',              label: 'Anti-money-laundering / KYC',      regulator: 'SAFIU',                mandatory: true },
  { key: 'consumer_protection',  label: 'Consumer protection',              regulator: 'MCI',                  mandatory: true },
  // 10 contextual
  { key: 'health_safety',        label: 'Occupational health & safety',     regulator: 'MHRSD',                mandatory: false, sectors: ['manufacturing', 'construction', 'logistics', 'energy'] },
  { key: 'environment',          label: 'Environmental compliance',         regulator: 'NCEC',                 mandatory: false, sectors: ['manufacturing', 'energy', 'construction'] },
  { key: 'food_safety',          label: 'Food safety',                      regulator: 'SFDA',                 mandatory: false, sectors: ['food', 'restaurants', 'retail'] },
  { key: 'medical_devices',      label: 'Medical devices',                  regulator: 'SFDA',                 mandatory: false, sectors: ['healthcare', 'medical'] },
  { key: 'pharma',               label: 'Pharma & cosmetics',               regulator: 'SFDA',                 mandatory: false, sectors: ['pharma', 'cosmetics'] },
  { key: 'banking_sama',         label: 'Banking & finance',                regulator: 'SAMA',                 mandatory: false, sectors: ['banking', 'fintech', 'insurance'] },
  { key: 'capital_markets_cma',  label: 'Capital markets',                  regulator: 'CMA',                  mandatory: false, sectors: ['investment', 'asset_mgmt'] },
  { key: 'telecom_cst',          label: 'Telecom & ICT',                    regulator: 'CST',                  mandatory: false, sectors: ['telecom', 'ict'] },
  { key: 'construction_safety',  label: 'Construction compliance',          regulator: 'MoMRAH',               mandatory: false, sectors: ['construction', 'real_estate'] },
  { key: 'export_import_customs',label: 'Customs & trade',                  regulator: 'ZATCA Customs',        mandatory: false, sectors: ['trading', 'logistics', 'manufacturing'] },
];

// Compact builder: per-axis 8 mandatory questions × 8 axes = 64.
const LIKERT: [string, string, string, string] = [
  'Missing or expired',
  'Partial / ad-hoc',
  'Documented + in place',
  'Audited + optimized',
];

function ax(axis: ComplianceAxisKey, i: number, prompt: string): ComplianceProQuestion {
  return {
    id: `${axis}_${i}`,
    axis,
    prompt,
    options: [
      { value: 'none', label: LIKERT[0], score: 0 },
      { value: 'partial', label: LIKERT[1], score: 1 },
      { value: 'good', label: LIKERT[2], score: 2 },
      { value: 'great', label: LIKERT[3], score: 3 },
    ],
  };
}

export interface ComplianceProQuestion {
  id: string;
  axis: ComplianceAxisKey;
  prompt: string;
  options: DeptQuestion['options'];
}

export const COMPLIANCE_PRO_QUESTIONS: ComplianceProQuestion[] = [
  // commercial (1–8)
  ax('commercial', 1, 'Commercial Registration (CR) current'),
  ax('commercial', 2, 'Municipality license (Baladi) current'),
  ax('commercial', 3, 'Activity-specific licenses present'),
  ax('commercial', 4, 'Chamber of Commerce membership'),
  ax('commercial', 5, 'Trademark / IP registration'),
  ax('commercial', 6, 'Foreign-investment license (MISA) if applicable'),
  ax('commercial', 7, 'Branch / multi-location registrations'),
  ax('commercial', 8, 'Annual returns filed on time'),
  // tax_zakat (1–8)
  ax('tax_zakat', 1, 'Zakat / corporate tax filings on time'),
  ax('tax_zakat', 2, 'VAT registration + monthly/quarterly returns'),
  ax('tax_zakat', 3, 'E-invoicing (Fatoora) integration'),
  ax('tax_zakat', 4, 'Withholding-tax compliance'),
  ax('tax_zakat', 5, 'Transfer-pricing documentation'),
  ax('tax_zakat', 6, 'Tax-loss / capital-allowance records'),
  ax('tax_zakat', 7, 'Excise tax registration if applicable'),
  ax('tax_zakat', 8, 'Tax-audit readiness file'),
  // labor_saudization (1–8)
  ax('labor_saudization', 1, 'Nitaqat band tracked + targeted'),
  ax('labor_saudization', 2, 'Qiwa contracts up to date'),
  ax('labor_saudization', 3, 'Mudad payroll integration'),
  ax('labor_saudization', 4, 'WPS salary protection'),
  ax('labor_saudization', 5, 'GOSI registrations + payments'),
  ax('labor_saudization', 6, 'End-of-service benefit accruals'),
  ax('labor_saudization', 7, 'Work permits / Iqama renewals'),
  ax('labor_saudization', 8, 'Health-insurance (CCHI) coverage'),
  // data_privacy (1–8)
  ax('data_privacy', 1, 'PDPL data-inventory complete'),
  ax('data_privacy', 2, 'DPO appointed if required'),
  ax('data_privacy', 3, 'Lawful-basis register'),
  ax('data_privacy', 4, 'Consent capture + revocation flows'),
  ax('data_privacy', 5, 'Cross-border transfer assessments'),
  ax('data_privacy', 6, 'Data-subject rights process'),
  ax('data_privacy', 7, 'Breach notification process'),
  ax('data_privacy', 8, 'Privacy notice published'),
  // cybersecurity (1–8)
  ax('cybersecurity', 1, 'ECC controls applied + evidenced'),
  ax('cybersecurity', 2, 'Asset inventory + classification'),
  ax('cybersecurity', 3, 'Access-management (least privilege)'),
  ax('cybersecurity', 4, 'Patch / vulnerability management'),
  ax('cybersecurity', 5, 'Incident-response plan tested'),
  ax('cybersecurity', 6, 'Backup + DR plan exercised'),
  ax('cybersecurity', 7, 'Third-party / vendor risk reviews'),
  ax('cybersecurity', 8, 'Awareness training for all staff'),
  // corporate_gov (1–8)
  ax('corporate_gov', 1, 'Articles of Association + delegations'),
  ax('corporate_gov', 2, 'Board / partners meetings minutes'),
  ax('corporate_gov', 3, 'Conflict-of-interest declarations'),
  ax('corporate_gov', 4, 'Related-party transaction policy'),
  ax('corporate_gov', 5, 'Whistleblower channel + protection'),
  ax('corporate_gov', 6, 'Code of conduct signed'),
  ax('corporate_gov', 7, 'Risk register reviewed quarterly'),
  ax('corporate_gov', 8, 'Internal audit / equivalent function'),
  // aml_kyc (1–8)
  ax('aml_kyc', 1, 'AML / CFT policy documented'),
  ax('aml_kyc', 2, 'Customer-due-diligence (KYC) on onboarding'),
  ax('aml_kyc', 3, 'Sanctions / PEP screening'),
  ax('aml_kyc', 4, 'Suspicious-transaction reporting (STR)'),
  ax('aml_kyc', 5, 'Ultimate-beneficial-owner (UBO) register'),
  ax('aml_kyc', 6, 'AML training delivered yearly'),
  ax('aml_kyc', 7, 'Independent AML audit'),
  ax('aml_kyc', 8, 'Record retention (5–10 years)'),
  // consumer_protection (1–8)
  ax('consumer_protection', 1, 'Terms & conditions published + clear'),
  ax('consumer_protection', 2, 'Refund / return policy'),
  ax('consumer_protection', 3, 'Truthful marketing + claims'),
  ax('consumer_protection', 4, 'Pricing transparency (incl. VAT)'),
  ax('consumer_protection', 5, 'Warranty / after-sale support'),
  ax('consumer_protection', 6, 'Complaint-handling channel'),
  ax('consumer_protection', 7, 'Arabic disclosure where required'),
  ax('consumer_protection', 8, 'Accessibility / inclusive design'),
];

// KO licenses — license dates that, when expired, force the axis score to 0.
export interface KOLicense {
  key: string;
  label: string;
  axis: ComplianceAxisKey;
  appliesWhen?: 'always' | 'sector';
  sectors?: string[];
}

export const KO_LICENSES: KOLicense[] = [
  { key: 'cr_expiry',         label: 'Commercial Registration expiry',      axis: 'commercial',       appliesWhen: 'always' },
  { key: 'baladi_expiry',     label: 'Municipality license expiry',         axis: 'commercial',       appliesWhen: 'always' },
  { key: 'vat_cert_expiry',   label: 'VAT certificate expiry',              axis: 'tax_zakat',        appliesWhen: 'always' },
  { key: 'gosi_cert_expiry',  label: 'GOSI compliance cert expiry',         axis: 'labor_saudization',appliesWhen: 'always' },
  { key: 'cchi_expiry',       label: 'CCHI health-insurance expiry',        axis: 'labor_saudization',appliesWhen: 'always' },
  { key: 'cybersec_cert',     label: 'NCA cybersecurity cert expiry',       axis: 'cybersecurity',    appliesWhen: 'sector', sectors: ['banking', 'fintech', 'telecom', 'ict'] },
];

export function activeAxesForSector(sector?: string): ComplianceAxisDef[] {
  const s = sector?.toLowerCase().trim();
  return COMPLIANCE_AXES.filter((a) => {
    if (a.mandatory) return true;
    if (!s || !a.sectors) return false;
    return a.sectors.includes(s);
  });
}
