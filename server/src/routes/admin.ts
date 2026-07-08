import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminGuard';
import { adminStats } from '../controllers/admin';

// خريطة الحماية:
//   GET /stats — Admin only (SEC-2). لا تعتمد على الباقة — إحصائيات النظام
//                لمسؤولي النظام فقط، بغضّ النظر عن baقة المستخدم.
const router = Router();
router.get('/stats', requireAuth, requireAdmin, adminStats);
export default router;
