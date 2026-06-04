import { Router } from 'express';
import {
  previewOwnerDiagnostic,
  submitOwnerDiagnostic,
  submitManagerDiagnostic,
  submitInvestorDiagnostic,
  getLatestDiagnostic,
  getMyLatestDiagnostic,
} from '../controllers/diagnostic';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/preview', previewOwnerDiagnostic);
router.post('/owner', requireAuth, submitOwnerDiagnostic);
router.post('/manager', requireAuth, submitManagerDiagnostic);
router.post('/investor', requireAuth, submitInvestorDiagnostic);
// Order matters: `/me/latest` must be registered before `/:companyId/latest`.
router.get('/me/latest', requireAuth, getMyLatestDiagnostic);
router.get('/:companyId/latest', requireAuth, getLatestDiagnostic);

export default router;
