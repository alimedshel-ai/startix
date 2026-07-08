import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  createInvitation,
  listCompanyInvitations,
  acceptInvitation,
} from '../controllers/invitations';

// كل endpoints خلف requireAuth. صلاحية الشركة تُتحقَّق داخل الكونترولر
// عبر assertCompanyAccess (للإنشاء والقائمة). القبول يتحقّق من مطابقة البريد.
const router = Router();

router.post('/', requireAuth, createInvitation);
router.get('/company/:companyId', requireAuth, listCompanyInvitations);
router.post('/:token/accept', requireAuth, acceptInvitation);

export default router;
