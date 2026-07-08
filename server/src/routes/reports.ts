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

// خريطة الحماية:
//   POST /              — BASIC+  (توليد تقرير JSON)
//   GET  /company/:id   — BASIC+
//   GET  /:id           — BASIC+
//   GET  /:id/excel     — PROFESSIONAL+  ⭐ (تصدير Excel)
//   DELETE /:id         — BASIC+
const router = Router();
router.post('/', requireAuth, generateReport);
router.get('/company/:companyId', requireAuth, listReports);
router.get('/:id', requireAuth, getReport);
router.get('/:id/excel', requireAuth, requirePlan('PROFESSIONAL'), downloadReportExcel);
router.delete('/:id', requireAuth, deleteReport);
export default router;
