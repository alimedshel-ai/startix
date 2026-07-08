import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { adminStats } from '../controllers/admin';

// خريطة الحماية:
//   GET /stats — BASIC+  (يجب أن يُضاف فحص دور Admin مستقبلاً — راجع
//                          تقرير الفحص السابق: أي مستخدم مصادَق يقدر يطّلع
//                          على إحصائيات النظام حالياً. خارج نطاق C22.)
const router = Router();
router.get('/stats', requireAuth, adminStats);
export default router;
