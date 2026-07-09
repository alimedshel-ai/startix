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
  onboardingEnrich,
} from '../controllers/auth';
import { requireAuth } from '../middleware/auth';
import {
  loginRateLimit,
  registerRateLimit,
  forgotPasswordRateLimit,
} from '../middleware/rateLimit';

// خريطة الحماية:
//   /register        — عام + rate-limit (3/ساعة IP في الإنتاج)
//   /login           — عام + rate-limit (5/15د IP في الإنتاج)
//   /logout /refresh — عام (بلا مصادقة)
//   /forgot-password — عام + rate-limit (3/ساعة IP في الإنتاج)
//   /reset-password  — عام (يعتمد على رمز موقّع)
//   /verify-email    — عام (يعتمد على رمز موقّع)
//   /me GET + PATCH  — BASIC+ (أي مستخدم مسجّل)
const router = Router();

router.post('/register', registerRateLimit, register);
router.post('/login', loginRateLimit, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPasswordRateLimit, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);
// R1.3 — إثراء بيانات ما‑بعد‑التسجيل (pains/goals/opex/sector/entityType).
router.post('/onboarding', requireAuth, onboardingEnrich);

export default router;
