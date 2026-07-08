import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/planGuard';
import {
  getComplianceQuestions,
  submitComplianceBasic,
  submitCompliancePro,
  getLatestCompliance,
  getComplianceMeta,
} from '../controllers/compliance';

// خريطة الحماية:
//   /meta                             — عام (بلا مصادقة)
//   /:companyId/questions             — BASIC+  (كل الباقات)
//   /:companyId/audit          POST   — BASIC+  (كل الباقات)
//   /:companyId/audit-pro      POST   — PROFESSIONAL+  ⭐
//   /:companyId/latest         GET    — BASIC+
const router = Router();

router.get('/meta', getComplianceMeta);
router.get('/:companyId/questions', requireAuth, getComplianceQuestions);
router.post('/:companyId/audit', requireAuth, submitComplianceBasic);
router.post('/:companyId/audit-pro', requireAuth, requirePlan('PROFESSIONAL'), submitCompliancePro);
router.get('/:companyId/latest', requireAuth, getLatestCompliance);

export default router;
