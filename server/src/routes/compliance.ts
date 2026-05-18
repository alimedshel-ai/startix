import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  getComplianceQuestions,
  submitComplianceBasic,
  submitCompliancePro,
  getLatestCompliance,
  getComplianceMeta,
} from '../controllers/compliance';

const router = Router();

router.get('/meta', getComplianceMeta);
router.get('/:companyId/questions', requireAuth, getComplianceQuestions);
router.post('/:companyId/audit', requireAuth, submitComplianceBasic);
router.post('/:companyId/audit-pro', requireAuth, submitCompliancePro);
router.get('/:companyId/latest', requireAuth, getLatestCompliance);

export default router;
