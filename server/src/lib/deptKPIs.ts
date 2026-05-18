// Per-department SMART KPI bank. Each KPI ships with a target derived from
// the company's industry-typical range, then adjusted up or down based on the
// department's audit score. Used by services/deptSmartEngine.ts.

import type { DeptCode } from './deptQuestions';

export interface KPISpec {
  name: string;
  unit: string;
  baseTarget: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  // If true, lower values are better — the engine inverts the adjustment.
  lowerIsBetter?: boolean;
}

export const DEPT_KPI_BANK: Record<DeptCode, KPISpec[]> = {
  HR: [
    { name: 'Annual turnover',            unit: '%',      baseTarget: 10, frequency: 'quarterly', lowerIsBetter: true },
    { name: 'Time-to-hire',               unit: 'days',   baseTarget: 30, frequency: 'monthly',   lowerIsBetter: true },
    { name: 'Training hours / employee',  unit: 'hours',  baseTarget: 40, frequency: 'quarterly' },
    { name: 'Engagement score',           unit: '/100',   baseTarget: 75, frequency: 'quarterly' },
  ],
  FINANCE: [
    { name: 'Gross margin',          unit: '%',     baseTarget: 35, frequency: 'monthly' },
    { name: 'Operating margin',      unit: '%',     baseTarget: 15, frequency: 'monthly' },
    { name: 'Days sales outstanding',unit: 'days',  baseTarget: 45, frequency: 'monthly', lowerIsBetter: true },
    { name: 'Cash runway',           unit: 'months',baseTarget: 6,  frequency: 'monthly' },
  ],
  SALES: [
    { name: 'Pipeline value / quota',     unit: 'x',   baseTarget: 3,  frequency: 'monthly' },
    { name: 'Lead → win conversion',      unit: '%',   baseTarget: 20, frequency: 'monthly' },
    { name: 'Average deal size',          unit: 'SAR', baseTarget: 50_000, frequency: 'monthly' },
    { name: 'Sales cycle length',         unit: 'days',baseTarget: 45, frequency: 'monthly', lowerIsBetter: true },
  ],
  MARKETING: [
    { name: 'Marketing ROI',          unit: 'x',   baseTarget: 4, frequency: 'quarterly' },
    { name: 'Cost per acquisition',   unit: 'SAR', baseTarget: 200, frequency: 'monthly', lowerIsBetter: true },
    { name: 'MQL → SQL conversion',   unit: '%',   baseTarget: 25, frequency: 'monthly' },
    { name: 'Brand awareness lift',   unit: '%',   baseTarget: 10, frequency: 'quarterly' },
  ],
  OPERATIONS: [
    { name: 'On-time delivery',          unit: '%',  baseTarget: 95, frequency: 'weekly' },
    { name: 'Capacity utilization',      unit: '%',  baseTarget: 80, frequency: 'weekly' },
    { name: 'Defect / rework rate',      unit: '%',  baseTarget: 2,  frequency: 'weekly', lowerIsBetter: true },
    { name: 'Cycle time',                unit: 'hours', baseTarget: 24, frequency: 'weekly', lowerIsBetter: true },
  ],
  IT: [
    { name: 'System uptime',         unit: '%',     baseTarget: 99.5, frequency: 'monthly' },
    { name: 'Mean time to recover',  unit: 'hours', baseTarget: 2,    frequency: 'monthly', lowerIsBetter: true },
    { name: 'Patch compliance',      unit: '%',     baseTarget: 95,   frequency: 'monthly' },
    { name: 'Backup success rate',   unit: '%',     baseTarget: 100,  frequency: 'weekly' },
  ],
  CUSTOMER_SERVICE: [
    { name: 'CSAT',                       unit: '/100', baseTarget: 85, frequency: 'monthly' },
    { name: 'Net promoter score',         unit: 'NPS',  baseTarget: 40, frequency: 'quarterly' },
    { name: 'First-contact resolution',   unit: '%',    baseTarget: 70, frequency: 'monthly' },
    { name: 'Average handle time',        unit: 'min',  baseTarget: 5,  frequency: 'weekly', lowerIsBetter: true },
  ],
  SUPPORT: [
    { name: 'Supplier on-time delivery', unit: '%',  baseTarget: 95, frequency: 'monthly' },
    { name: 'Cost-savings per quarter',  unit: '%',  baseTarget: 5,  frequency: 'quarterly' },
    { name: 'Quality acceptance rate',   unit: '%',  baseTarget: 98, frequency: 'monthly' },
    { name: 'Sourcing cycle time',       unit: 'days', baseTarget: 14, frequency: 'monthly', lowerIsBetter: true },
  ],
  LOGISTICS: [
    { name: 'On-time-in-full (OTIF)',     unit: '%',  baseTarget: 95, frequency: 'weekly' },
    { name: 'Cost per shipment',          unit: 'SAR', baseTarget: 50, frequency: 'monthly', lowerIsBetter: true },
    { name: 'Inventory accuracy',         unit: '%',  baseTarget: 98, frequency: 'monthly' },
    { name: 'Order cycle time',           unit: 'hours', baseTarget: 24, frequency: 'weekly', lowerIsBetter: true },
  ],
  QUALITY: [
    { name: 'Defect rate',                  unit: 'ppm', baseTarget: 1000, frequency: 'weekly', lowerIsBetter: true },
    { name: 'Cost of poor quality',         unit: '% of revenue', baseTarget: 2, frequency: 'monthly', lowerIsBetter: true },
    { name: 'First-pass yield',             unit: '%', baseTarget: 95, frequency: 'weekly' },
    { name: 'Customer complaints / 1000',   unit: 'count', baseTarget: 5, frequency: 'monthly', lowerIsBetter: true },
  ],
  PROJECTS: [
    { name: 'On-time delivery',     unit: '%',  baseTarget: 85, frequency: 'monthly' },
    { name: 'On-budget delivery',   unit: '%',  baseTarget: 85, frequency: 'monthly' },
    { name: 'Scope-creep rate',     unit: '%',  baseTarget: 10, frequency: 'monthly', lowerIsBetter: true },
    { name: 'Resource utilization', unit: '%',  baseTarget: 80, frequency: 'weekly' },
  ],
  GOVERNANCE: [
    { name: 'Board meetings / year',   unit: 'count', baseTarget: 4, frequency: 'quarterly' },
    { name: 'Policy review completion',unit: '%',     baseTarget: 100, frequency: 'quarterly' },
    { name: 'Risk-register reviews',   unit: 'count', baseTarget: 4, frequency: 'quarterly' },
    { name: 'Internal-audit coverage', unit: '%',     baseTarget: 80, frequency: 'quarterly' },
  ],
  COMPLIANCE: [
    { name: 'Violations',                   unit: 'count', baseTarget: 0, frequency: 'monthly', lowerIsBetter: true },
    { name: 'Policy compliance',            unit: '%',     baseTarget: 95, frequency: 'monthly' },
    { name: 'Training completion',          unit: '%',     baseTarget: 100, frequency: 'quarterly' },
    { name: 'Resolution time',              unit: 'days',  baseTarget: 14, frequency: 'monthly', lowerIsBetter: true },
    { name: 'Cost of compliance',           unit: '% of revenue', baseTarget: 2, frequency: 'quarterly', lowerIsBetter: true },
    { name: 'Whistleblower reports closed', unit: '%',     baseTarget: 100, frequency: 'quarterly' },
  ],
};
