import { Router } from 'express';
import {
  submitOwnerDiagnostic,
  submitManagerDiagnostic,
  submitInvestorDiagnostic,
  getLatestDiagnostic,
} from '../controllers/diagnostic';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/owner', requireAuth, submitOwnerDiagnostic);
router.post('/manager', requireAuth, submitManagerDiagnostic);
router.post('/investor', requireAuth, submitInvestorDiagnostic);
router.get('/:companyId/latest', requireAuth, getLatestDiagnostic);

export default router;
