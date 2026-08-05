import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/planGuard';
import {
  generateReport,
  listReports,
  getReport,
  deleteReport,
  downloadReportExcel,
  shareReport,
  getSharedReport,
} from '../controllers/reports';

// خريطة الحماية:
//   GET  /shared/:token — عامّ (بلا مصادقة؛ الحماية بالتوكن) ⭐
//   POST /              — BASIC+  (توليد تقرير JSON)
//   GET  /company/:id   — BASIC+
//   GET  /:id           — BASIC+
//   GET  /:id/excel     — PROFESSIONAL+  ⭐ (تصدير Excel)
//   POST /:id/share     — PROFESSIONAL+  ⭐ (سكّ رابط مشاركة عامّ)
//   DELETE /:id         — BASIC+
const router = Router();
// عامّ — يُسجَّل قبل /:id كي لا يلتقطه كمعرّف.
router.get('/shared/:token', getSharedReport);
router.post('/', requireAuth, generateReport);
router.get('/company/:companyId', requireAuth, listReports);
router.get('/:id', requireAuth, getReport);
router.get('/:id/excel', requireAuth, requirePlan('PROFESSIONAL'), downloadReportExcel);
router.post('/:id/share', requireAuth, requirePlan('PROFESSIONAL'), shareReport);
router.delete('/:id', requireAuth, deleteReport);
export default router;
