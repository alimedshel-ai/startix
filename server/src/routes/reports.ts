import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/planGuard';
import {
  generateReport,
  listReports,
  getReport,
  deleteReport,
  downloadReportExcel,
} from '../controllers/reports';

const router = Router();
router.post('/', requireAuth, generateReport);
router.get('/company/:companyId', requireAuth, listReports);
router.get('/:id', requireAuth, getReport);
// Excel export is a Professional feature per the pricing plan.
router.get('/:id/excel', requireAuth, requirePlan('PROFESSIONAL'), downloadReportExcel);
router.delete('/:id', requireAuth, deleteReport);
export default router;
