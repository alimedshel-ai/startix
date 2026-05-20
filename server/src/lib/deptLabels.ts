// Arabic labels for department codes — kept here so backend code (reports,
// AI prompts) can render the same names the client uses.

import type { DeptCode } from './deptQuestions';

export const DEPT_LABEL_AR: Record<DeptCode, string> = {
  HR: 'الموارد البشرية',
  FINANCE: 'المالية',
  SALES: 'المبيعات',
  MARKETING: 'التسويق',
  OPERATIONS: 'العمليات',
  IT: 'تقنية المعلومات',
  CUSTOMER_SERVICE: 'خدمة العملاء',
  SUPPORT: 'الإمداد والدعم',
  LOGISTICS: 'اللوجستيات',
  QUALITY: 'الجودة',
  PROJECTS: 'المشاريع',
  GOVERNANCE: 'الحوكمة',
  COMPLIANCE: 'الامتثال',
};
