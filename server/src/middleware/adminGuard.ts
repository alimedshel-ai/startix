import { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { HttpError } from './error';

// SEC-2 — يفحص علم `isAdmin` على المستخدم قبل السماح بالوصول لأي مسار
// إداري. يجب أن يأتي بعد `requireAuth` لأنّه يعتمد على `req.auth.sub`.
// اختيار الاستعلام على DB بدل حمل الفلاغ في الـ JWT مقصود: قد نُلغي
// صلاحية admin بلحظة، ولا نريد انتظار انتهاء الـ access_token.
export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      select: { isAdmin: true },
    });
    if (!user) throw new HttpError(401, 'الحساب غير موجود');
    if (!user.isAdmin) throw new HttpError(403, 'هذا المسار مخصّص لمسؤولي النظام فقط');
    next();
  } catch (err) {
    next(err);
  }
};
