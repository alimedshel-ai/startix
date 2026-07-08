import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { generateRecommendations, listRecommendations } from '../controllers/insight';

// خريطة الحماية: كل مسارات /api/insight BASIC+.
// (محرك استدلال قائم على قواعد حتمية — لا يتطلب Claude، متاح للجميع.)
// الوصول للشركة يُفرَض داخل الكونترولر عبر assertCompanyAccess.
const router = Router();

router.post('/:companyId/generate', requireAuth, generateRecommendations);
router.get('/:companyId', requireAuth, listRecommendations);

export default router;
