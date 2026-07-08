import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  createBreakEven,
  getLatestBreakEven,
  getBreakEvenHistory,
} from '../controllers/finance';

// جميع endpoints خلف requireAuth. الوصول للشركة يُفرَض داخل الكونترولر
// عبر assertCompanyAccess.
const router = Router();

router.post('/break-even', requireAuth, createBreakEven);
router.get('/break-even/:companyId/latest', requireAuth, getLatestBreakEven);
router.get('/break-even/:companyId/history', requireAuth, getBreakEvenHistory);

export default router;
