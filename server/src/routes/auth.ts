import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  verifyEmail,
  me,
  updateMe,
} from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

// خريطة الحماية:
//   /register /login /logout /refresh /forgot /reset /verify — عام (بلا مصادقة)
//   /me GET + PATCH — BASIC+ (أي مستخدم مسجّل)
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

export default router;
