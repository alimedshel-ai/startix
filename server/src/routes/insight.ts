import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { generateRecommendations, listRecommendations } from '../controllers/insight';

// كل endpoints خلف requireAuth. صلاحية الشركة تُتحقَّق داخل الكونترولر
// عبر assertCompanyAccess.
const router = Router();

router.post('/:companyId/generate', requireAuth, generateRecommendations);
router.get('/:companyId', requireAuth, listRecommendations);

export default router;
