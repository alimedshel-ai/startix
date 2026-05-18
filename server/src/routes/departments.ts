import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
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

const router = Router();

// Per plan §5.1
router.get('/me/first-company', requireAuth, getMyFirstCompany);
router.post('/', requireAuth, createDepartment);
router.get('/company/:companyId', requireAuth, listDepartments);
router.get('/:id/questions', requireAuth, getDepartmentQuestions);
router.post('/:id/audit', requireAuth, submitDeptAudit);
router.post('/:id/audit-pro', requireAuth, submitDeptAuditPro);
router.get('/:id/audit/latest', requireAuth, getLatestDeptAudit);
router.post('/:id/smart', requireAuth, submitDeptSmart);

export default router;
