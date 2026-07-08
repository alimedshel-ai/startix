import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  createBreakEven,
  getLatestBreakEven,
  getBreakEvenHistory,
  createDupont,
  getLatestDupont,
  createMonteCarloRun,
  getLatestMonteCarloRun,
} from '../controllers/finance';

// خريطة الحماية: كل مسارات /api/finance BASIC+.
// الوصول للشركة يُفرَض داخل الكونترولر عبر assertCompanyAccess.
// (Break-Even + Dupont + Monte Carlo كلها متاحة للباقة الأساسية.)
const router = Router();

// C12 — Break-even
router.post('/break-even', requireAuth, createBreakEven);
router.get('/break-even/:companyId/latest', requireAuth, getLatestBreakEven);
router.get('/break-even/:companyId/history', requireAuth, getBreakEvenHistory);

// C13 — Dupont
router.post('/dupont', requireAuth, createDupont);
router.get('/dupont/:companyId/latest', requireAuth, getLatestDupont);

// C13 — Monte Carlo
router.post('/monte-carlo', requireAuth, createMonteCarloRun);
router.get('/monte-carlo/:companyId/latest', requireAuth, getLatestMonteCarloRun);

export default router;
