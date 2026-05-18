// Department audit question banks. Each department has a basic audit and
// (for departments that support it) an audit-pro with more questions. Every
// question is tagged with an axis — governance, financial, team, digital —
// and a Likert 0..3 score per option. The auditEngine scales raw axis scores
// to the per-axis cap (governance/financial 30, team/digital 20).

export type AuditAxis = 'governance' | 'financial' | 'team' | 'digital';

export type DeptCode =
  | 'HR'
  | 'FINANCE'
  | 'SALES'
  | 'MARKETING'
  | 'OPERATIONS'
  | 'IT'
  | 'CUSTOMER_SERVICE'
  | 'SUPPORT'
  | 'LOGISTICS'
  | 'QUALITY'
  | 'PROJECTS'
  | 'GOVERNANCE'
  | 'COMPLIANCE';

export interface DeptQOption {
  value: string;
  label: string;
  score: 0 | 1 | 2 | 3;
}

export interface DeptQuestion {
  id: string;
  axis: AuditAxis;
  prompt: string;
  options: [DeptQOption, DeptQOption, DeptQOption, DeptQOption];
}

export interface DeptBank {
  basic: DeptQuestion[];
  pro?: DeptQuestion[];
}

// Compact builder so the file stays readable. Every question is a
// 4-option Likert (none / partial / good / great → 0..3).
function q(
  id: string,
  axis: AuditAxis,
  prompt: string,
  labels: [string, string, string, string]
): DeptQuestion {
  return {
    id,
    axis,
    prompt,
    options: [
      { value: 'none', label: labels[0], score: 0 },
      { value: 'partial', label: labels[1], score: 1 },
      { value: 'good', label: labels[2], score: 2 },
      { value: 'great', label: labels[3], score: 3 },
    ],
  };
}

const STANDARD_LIKERT: [string, string, string, string] = [
  'Not in place',
  'Partial / ad-hoc',
  'In place and documented',
  'Optimized + measured',
];

// ─── HR ──────────────────────────────────────────────────────────────────────
const HR: DeptBank = {
  basic: [
    q('hr_gov_1', 'governance', 'Written HR policies (hiring, termination, leave)', STANDARD_LIKERT),
    q('hr_gov_2', 'governance', 'Documented org chart and roles', STANDARD_LIKERT),
    q('hr_gov_3', 'governance', 'Performance review cycle', STANDARD_LIKERT),
    q('hr_fin_1', 'financial', 'Payroll process and accuracy', STANDARD_LIKERT),
    q('hr_fin_2', 'financial', 'Compensation benchmarking', STANDARD_LIKERT),
    q('hr_fin_3', 'financial', 'HR cost tracking per headcount', STANDARD_LIKERT),
    q('hr_team_1', 'team', 'Onboarding program for new hires', STANDARD_LIKERT),
    q('hr_team_2', 'team', 'Training and development plan', STANDARD_LIKERT),
    q('hr_team_3', 'team', 'Employee engagement / pulse surveys', STANDARD_LIKERT),
    q('hr_dig_1', 'digital', 'HR information system (HRIS)', STANDARD_LIKERT),
    q('hr_dig_2', 'digital', 'Digital leave / attendance tracking', STANDARD_LIKERT),
    q('hr_dig_3', 'digital', 'Self-service portal for employees', STANDARD_LIKERT),
  ],
  pro: [
    q('hr_pro_gov_1', 'governance', 'Succession plan for key roles', STANDARD_LIKERT),
    q('hr_pro_gov_2', 'governance', 'Code of conduct + grievance process', STANDARD_LIKERT),
    q('hr_pro_fin_1', 'financial', 'Variable pay / incentives tied to KPIs', STANDARD_LIKERT),
    q('hr_pro_fin_2', 'financial', 'Total reward statement issued annually', STANDARD_LIKERT),
    q('hr_pro_team_1', 'team', 'Leadership development pipeline', STANDARD_LIKERT),
    q('hr_pro_team_2', 'team', 'Diversity & inclusion targets tracked', STANDARD_LIKERT),
    q('hr_pro_dig_1', 'digital', 'People analytics dashboard', STANDARD_LIKERT),
    q('hr_pro_dig_2', 'digital', 'Learning management system', STANDARD_LIKERT),
  ],
};

// ─── Finance ─────────────────────────────────────────────────────────────────
const FINANCE: DeptBank = {
  basic: [
    q('fin_gov_1', 'governance', 'Approval matrix for spend', STANDARD_LIKERT),
    q('fin_gov_2', 'governance', 'Segregation of duties (AP / AR / treasury)', STANDARD_LIKERT),
    q('fin_gov_3', 'governance', 'External audit performed', STANDARD_LIKERT),
    q('fin_fin_1', 'financial', 'Monthly close cycle on time', STANDARD_LIKERT),
    q('fin_fin_2', 'financial', 'Cash-flow forecast (13-week rolling)', STANDARD_LIKERT),
    q('fin_fin_3', 'financial', 'Budget vs actual variance tracking', STANDARD_LIKERT),
    q('fin_team_1', 'team', 'Qualified finance staff (CPA/CMA)', STANDARD_LIKERT),
    q('fin_team_2', 'team', 'Cross-training within finance team', STANDARD_LIKERT),
    q('fin_team_3', 'team', 'Continuous learning / CPE hours', STANDARD_LIKERT),
    q('fin_dig_1', 'digital', 'Accounting software (ERP / cloud)', STANDARD_LIKERT),
    q('fin_dig_2', 'digital', 'Automated bank reconciliation', STANDARD_LIKERT),
    q('fin_dig_3', 'digital', 'BI dashboard for finance KPIs', STANDARD_LIKERT),
  ],
};

// ─── Sales ───────────────────────────────────────────────────────────────────
const SALES: DeptBank = {
  basic: [
    q('sales_gov_1', 'governance', 'Documented sales process / playbook', STANDARD_LIKERT),
    q('sales_gov_2', 'governance', 'Pricing approval workflow', STANDARD_LIKERT),
    q('sales_gov_3', 'governance', 'Contract review process', STANDARD_LIKERT),
    q('sales_fin_1', 'financial', 'Quota / target setting per rep', STANDARD_LIKERT),
    q('sales_fin_2', 'financial', 'Commission plan documented + paid on time', STANDARD_LIKERT),
    q('sales_fin_3', 'financial', 'Pipeline value vs quota tracked', STANDARD_LIKERT),
    q('sales_team_1', 'team', 'Onboarding program for new sales reps', STANDARD_LIKERT),
    q('sales_team_2', 'team', 'Regular sales coaching', STANDARD_LIKERT),
    q('sales_team_3', 'team', 'Win/loss reviews', STANDARD_LIKERT),
    q('sales_dig_1', 'digital', 'CRM in active use', STANDARD_LIKERT),
    q('sales_dig_2', 'digital', 'Sales analytics / forecast accuracy', STANDARD_LIKERT),
    q('sales_dig_3', 'digital', 'Lead-to-cash automation', STANDARD_LIKERT),
  ],
  pro: [
    q('sales_pro_gov_1', 'governance', 'Account segmentation strategy', STANDARD_LIKERT),
    q('sales_pro_fin_1', 'financial', 'Margin per deal tracked', STANDARD_LIKERT),
    q('sales_pro_team_1', 'team', 'Sales enablement function staffed', STANDARD_LIKERT),
    q('sales_pro_dig_1', 'digital', 'Predictive lead scoring', STANDARD_LIKERT),
  ],
};

// ─── Marketing ───────────────────────────────────────────────────────────────
const MARKETING: DeptBank = {
  basic: [
    q('mkt_gov_1', 'governance', 'Brand guidelines documented', STANDARD_LIKERT),
    q('mkt_gov_2', 'governance', 'Marketing strategy aligned to business goals', STANDARD_LIKERT),
    q('mkt_gov_3', 'governance', 'Approval flow for campaigns', STANDARD_LIKERT),
    q('mkt_fin_1', 'financial', 'Annual marketing budget set', STANDARD_LIKERT),
    q('mkt_fin_2', 'financial', 'ROI / CAC tracked per channel', STANDARD_LIKERT),
    q('mkt_fin_3', 'financial', 'Attribution / source-of-truth tool', STANDARD_LIKERT),
    q('mkt_team_1', 'team', 'Marketing roles defined + filled', STANDARD_LIKERT),
    q('mkt_team_2', 'team', 'Agency relationships managed', STANDARD_LIKERT),
    q('mkt_team_3', 'team', 'Training in modern channels', STANDARD_LIKERT),
    q('mkt_dig_1', 'digital', 'Website + SEO baseline', STANDARD_LIKERT),
    q('mkt_dig_2', 'digital', 'Marketing automation tool', STANDARD_LIKERT),
    q('mkt_dig_3', 'digital', 'Social media presence + analytics', STANDARD_LIKERT),
  ],
  pro: [
    q('mkt_pro_gov_1', 'governance', 'Product marketing + positioning playbook', STANDARD_LIKERT),
    q('mkt_pro_fin_1', 'financial', 'MQL→SQL conversion measured', STANDARD_LIKERT),
    q('mkt_pro_team_1', 'team', 'Content team or content calendar', STANDARD_LIKERT),
    q('mkt_pro_dig_1', 'digital', 'CDP / unified customer view', STANDARD_LIKERT),
  ],
};

// ─── Operations ──────────────────────────────────────────────────────────────
const OPERATIONS: DeptBank = {
  basic: [
    q('ops_gov_1', 'governance', 'Documented SOPs for core processes', STANDARD_LIKERT),
    q('ops_gov_2', 'governance', 'Continuous improvement / Kaizen reviews', STANDARD_LIKERT),
    q('ops_gov_3', 'governance', 'Incident-management process', STANDARD_LIKERT),
    q('ops_fin_1', 'financial', 'Unit cost / cost per output tracked', STANDARD_LIKERT),
    q('ops_fin_2', 'financial', 'Capacity vs demand planning', STANDARD_LIKERT),
    q('ops_fin_3', 'financial', 'Operational budget owned by manager', STANDARD_LIKERT),
    q('ops_team_1', 'team', 'Cross-training across operations', STANDARD_LIKERT),
    q('ops_team_2', 'team', 'Daily / weekly huddles', STANDARD_LIKERT),
    q('ops_team_3', 'team', 'Skills matrix maintained', STANDARD_LIKERT),
    q('ops_dig_1', 'digital', 'Workflow / BPM tool', STANDARD_LIKERT),
    q('ops_dig_2', 'digital', 'Operational dashboard live', STANDARD_LIKERT),
    q('ops_dig_3', 'digital', 'Automation of repetitive tasks', STANDARD_LIKERT),
  ],
};

// ─── IT ──────────────────────────────────────────────────────────────────────
const IT: DeptBank = {
  basic: [
    q('it_gov_1', 'governance', 'IT policy + access management', STANDARD_LIKERT),
    q('it_gov_2', 'governance', 'Vendor / SaaS register maintained', STANDARD_LIKERT),
    q('it_gov_3', 'governance', 'Information security policy', STANDARD_LIKERT),
    q('it_fin_1', 'financial', 'IT budget tracked', STANDARD_LIKERT),
    q('it_fin_2', 'financial', 'Software licensing reviewed yearly', STANDARD_LIKERT),
    q('it_fin_3', 'financial', 'Cost per user / TCO measured', STANDARD_LIKERT),
    q('it_team_1', 'team', 'IT staff coverage / on-call', STANDARD_LIKERT),
    q('it_team_2', 'team', 'Security awareness training', STANDARD_LIKERT),
    q('it_team_3', 'team', 'Certifications / skills upkeep', STANDARD_LIKERT),
    q('it_dig_1', 'digital', 'Backups + restore tested', STANDARD_LIKERT),
    q('it_dig_2', 'digital', 'Endpoint protection + MFA', STANDARD_LIKERT),
    q('it_dig_3', 'digital', 'Cloud / infrastructure monitoring', STANDARD_LIKERT),
  ],
};

// ─── Customer Service ───────────────────────────────────────────────────────
const CUSTOMER_SERVICE: DeptBank = {
  basic: [
    q('cs_gov_1', 'governance', 'Service-level agreements documented', STANDARD_LIKERT),
    q('cs_gov_2', 'governance', 'Escalation matrix', STANDARD_LIKERT),
    q('cs_gov_3', 'governance', 'Complaint policy and root-cause review', STANDARD_LIKERT),
    q('cs_fin_1', 'financial', 'Cost per ticket measured', STANDARD_LIKERT),
    q('cs_fin_2', 'financial', 'Cost vs CSAT correlation tracked', STANDARD_LIKERT),
    q('cs_fin_3', 'financial', 'Service budget reviewed quarterly', STANDARD_LIKERT),
    q('cs_team_1', 'team', 'CSR onboarding curriculum', STANDARD_LIKERT),
    q('cs_team_2', 'team', 'Coaching from QA scores', STANDARD_LIKERT),
    q('cs_team_3', 'team', 'Empowered to resolve without escalation', STANDARD_LIKERT),
    q('cs_dig_1', 'digital', 'Helpdesk / ticketing system', STANDARD_LIKERT),
    q('cs_dig_2', 'digital', 'Knowledge base for agents + customers', STANDARD_LIKERT),
    q('cs_dig_3', 'digital', 'Omnichannel (voice/chat/email/social)', STANDARD_LIKERT),
  ],
};

// ─── Supply / Support ───────────────────────────────────────────────────────
const SUPPORT: DeptBank = {
  basic: [
    q('sup_gov_1', 'governance', 'Supplier evaluation framework', STANDARD_LIKERT),
    q('sup_gov_2', 'governance', 'Master supplier list maintained', STANDARD_LIKERT),
    q('sup_gov_3', 'governance', 'Procurement policy + thresholds', STANDARD_LIKERT),
    q('sup_fin_1', 'financial', 'Price benchmarking / multi-quote', STANDARD_LIKERT),
    q('sup_fin_2', 'financial', 'Payment terms negotiated', STANDARD_LIKERT),
    q('sup_fin_3', 'financial', 'Spend analytics by category', STANDARD_LIKERT),
    q('sup_team_1', 'team', 'Buyers trained in negotiation', STANDARD_LIKERT),
    q('sup_team_2', 'team', 'Supplier relationship managers assigned', STANDARD_LIKERT),
    q('sup_team_3', 'team', 'Cross-functional sourcing committee', STANDARD_LIKERT),
    q('sup_dig_1', 'digital', 'e-Procurement / PO system', STANDARD_LIKERT),
    q('sup_dig_2', 'digital', 'Supplier portal / EDI', STANDARD_LIKERT),
    q('sup_dig_3', 'digital', 'Performance scorecards automated', STANDARD_LIKERT),
  ],
};

// ─── Logistics ──────────────────────────────────────────────────────────────
const LOGISTICS: DeptBank = {
  basic: [
    q('log_gov_1', 'governance', 'Inventory policy + cycle counts', STANDARD_LIKERT),
    q('log_gov_2', 'governance', 'Carrier contracts + SLAs', STANDARD_LIKERT),
    q('log_gov_3', 'governance', 'Returns / reverse-logistics policy', STANDARD_LIKERT),
    q('log_fin_1', 'financial', 'Shipping cost per order tracked', STANDARD_LIKERT),
    q('log_fin_2', 'financial', 'Inventory carrying cost monitored', STANDARD_LIKERT),
    q('log_fin_3', 'financial', 'On-time-in-full (OTIF) KPI', STANDARD_LIKERT),
    q('log_team_1', 'team', 'Warehouse safety training', STANDARD_LIKERT),
    q('log_team_2', 'team', 'Pickers / drivers performance reviewed', STANDARD_LIKERT),
    q('log_team_3', 'team', 'Cross-shift handover ritual', STANDARD_LIKERT),
    q('log_dig_1', 'digital', 'WMS / inventory system in use', STANDARD_LIKERT),
    q('log_dig_2', 'digital', 'Route optimization tool', STANDARD_LIKERT),
    q('log_dig_3', 'digital', 'Real-time shipment tracking', STANDARD_LIKERT),
  ],
};

// ─── Quality ────────────────────────────────────────────────────────────────
const QUALITY: DeptBank = {
  basic: [
    q('qa_gov_1', 'governance', 'Quality management system (e.g. ISO 9001)', STANDARD_LIKERT),
    q('qa_gov_2', 'governance', 'Documented quality policy', STANDARD_LIKERT),
    q('qa_gov_3', 'governance', 'Non-conformance / CAPA process', STANDARD_LIKERT),
    q('qa_fin_1', 'financial', 'Cost of poor quality (CoPQ) tracked', STANDARD_LIKERT),
    q('qa_fin_2', 'financial', 'Quality budget separate from operations', STANDARD_LIKERT),
    q('qa_fin_3', 'financial', 'Warranty / rework cost monitored', STANDARD_LIKERT),
    q('qa_team_1', 'team', 'Quality champions in each function', STANDARD_LIKERT),
    q('qa_team_2', 'team', 'Six Sigma / Lean training', STANDARD_LIKERT),
    q('qa_team_3', 'team', 'Daily quality huddles', STANDARD_LIKERT),
    q('qa_dig_1', 'digital', 'Statistical process control tool', STANDARD_LIKERT),
    q('qa_dig_2', 'digital', 'Defect tracking system', STANDARD_LIKERT),
    q('qa_dig_3', 'digital', 'Customer-feedback loop digitized', STANDARD_LIKERT),
  ],
};

// ─── Projects ───────────────────────────────────────────────────────────────
const PROJECTS: DeptBank = {
  basic: [
    q('prj_gov_1', 'governance', 'Project methodology (Agile / PMBOK)', STANDARD_LIKERT),
    q('prj_gov_2', 'governance', 'Steering committee / sponsor cadence', STANDARD_LIKERT),
    q('prj_gov_3', 'governance', 'Stage-gate / approval process', STANDARD_LIKERT),
    q('prj_fin_1', 'financial', 'Budget vs actuals per project', STANDARD_LIKERT),
    q('prj_fin_2', 'financial', 'Earned-value tracking', STANDARD_LIKERT),
    q('prj_fin_3', 'financial', 'Resource utilization tracked', STANDARD_LIKERT),
    q('prj_team_1', 'team', 'Certified PMs / Scrum Masters', STANDARD_LIKERT),
    q('prj_team_2', 'team', 'Cross-functional teams', STANDARD_LIKERT),
    q('prj_team_3', 'team', 'Retrospectives after each project', STANDARD_LIKERT),
    q('prj_dig_1', 'digital', 'Project tool (Jira / MS Project / Asana)', STANDARD_LIKERT),
    q('prj_dig_2', 'digital', 'Gantt / portfolio view available', STANDARD_LIKERT),
    q('prj_dig_3', 'digital', 'Automated status reporting', STANDARD_LIKERT),
  ],
};

// ─── Governance ─────────────────────────────────────────────────────────────
const GOVERNANCE: DeptBank = {
  basic: [
    q('gov_gov_1', 'governance', 'Board / advisory body active', STANDARD_LIKERT),
    q('gov_gov_2', 'governance', 'Charter, bylaws, and committees documented', STANDARD_LIKERT),
    q('gov_gov_3', 'governance', 'Conflict of interest policy', STANDARD_LIKERT),
    q('gov_fin_1', 'financial', 'Internal audit function or equivalent', STANDARD_LIKERT),
    q('gov_fin_2', 'financial', 'Financial controls reviewed yearly', STANDARD_LIKERT),
    q('gov_fin_3', 'financial', 'External auditor engaged', STANDARD_LIKERT),
    q('gov_team_1', 'team', 'Directors with independent qualifications', STANDARD_LIKERT),
    q('gov_team_2', 'team', 'Annual board evaluation', STANDARD_LIKERT),
    q('gov_team_3', 'team', 'Training for directors', STANDARD_LIKERT),
    q('gov_dig_1', 'digital', 'Board portal / secure document sharing', STANDARD_LIKERT),
    q('gov_dig_2', 'digital', 'Compliance / risk register digital', STANDARD_LIKERT),
    q('gov_dig_3', 'digital', 'KPI dashboard for board', STANDARD_LIKERT),
  ],
};

// ─── Compliance basic (8 questions per plan §5.3) ───────────────────────────
const COMPLIANCE_BASIC: DeptQuestion[] = [
  q('cmp_basic_1', 'governance', 'Commercial registration valid and up to date', STANDARD_LIKERT),
  q('cmp_basic_2', 'governance', 'Sector-specific licenses (CST, SFDA, …) renewed', STANDARD_LIKERT),
  q('cmp_basic_3', 'governance', 'Saudization (Nitaqat) status tracked', STANDARD_LIKERT),
  q('cmp_basic_4', 'financial', 'VAT / Zakat returns filed on time', STANDARD_LIKERT),
  q('cmp_basic_5', 'financial', 'GOSI contributions paid', STANDARD_LIKERT),
  q('cmp_basic_6', 'team', 'Labor-law contracts in place for every employee', STANDARD_LIKERT),
  q('cmp_basic_7', 'digital', 'PDPL / data-privacy program', STANDARD_LIKERT),
  q('cmp_basic_8', 'digital', 'Cybersecurity controls (NCA ECC)', STANDARD_LIKERT),
];

const COMPLIANCE: DeptBank = {
  basic: COMPLIANCE_BASIC,
};

// ─── Registry ───────────────────────────────────────────────────────────────
export const DEPT_BANKS: Record<DeptCode, DeptBank> = {
  HR,
  FINANCE,
  SALES,
  MARKETING,
  OPERATIONS,
  IT,
  CUSTOMER_SERVICE,
  SUPPORT,
  LOGISTICS,
  QUALITY,
  PROJECTS,
  GOVERNANCE,
  COMPLIANCE,
};

export function getDeptBank(code: DeptCode): DeptBank {
  return DEPT_BANKS[code];
}
