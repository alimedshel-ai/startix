import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/planGuard';
import {
  createDepartment,
  listDepartments,
  getDepartmentQuestions,
  submitDeptAudit,
  submitDeptAuditPro,
  getLatestDeptAudit,
  submitDeptSmart,
  getMyFirstCompany,
} from '../controllers/departments';

// خريطة الحماية:
//   /me/first-company            — BASIC+
//   POST /                       — BASIC+  (إنشاء قسم)
//   /company/:companyId          — BASIC+
//   /:id/questions               — BASIC+
//   /:id/audit         POST      — BASIC+  (تدقيق أساسي)
//   /:id/audit-pro     POST      — PROFESSIONAL+  ⭐
//   /:id/audit/latest  GET       — BASIC+
//   /:id/smart         POST      — BASIC+  (توصيات SMART قائمة على قواعد)
const router = Router();

router.get('/me/first-company', requireAuth, getMyFirstCompany);
router.post('/', requireAuth, createDepartment);
router.get('/company/:companyId', requireAuth, listDepartments);
router.get('/:id/questions', requireAuth, getDepartmentQuestions);
router.post('/:id/audit', requireAuth, submitDeptAudit);
router.post('/:id/audit-pro', requireAuth, requirePlan('PROFESSIONAL'), submitDeptAuditPro);
router.get('/:id/audit/latest', requireAuth, getLatestDeptAudit);
router.post('/:id/smart', requireAuth, submitDeptSmart);

export default router;
