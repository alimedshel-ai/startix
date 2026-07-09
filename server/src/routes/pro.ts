import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { getContradictions, getProOverview, listMyClients } from '../controllers/pro';

// خريطة الحماية:
//   GET /clients                       — BASIC+ (مقيّد بـ INDEPENDENT_PRO)
//   GET /overview                      — BASIC+ (مقيّد بـ INDEPENDENT_PRO)
//   GET /contradictions/:companyId     — BASIC+ (مقيّد بـ CompanyUser link)
const router = Router();

router.get('/clients', requireAuth, listMyClients);
router.get('/overview', requireAuth, getProOverview);
router.get('/contradictions/:companyId', requireAuth, getContradictions);

export default router;
