import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  generateReport,
  listReports,
  getReport,
  deleteReport,
} from '../controllers/reports';

const router = Router();
router.post('/', requireAuth, generateReport);
router.get('/company/:companyId', requireAuth, listReports);
router.get('/:id', requireAuth, getReport);
router.delete('/:id', requireAuth, deleteReport);
export default router;
