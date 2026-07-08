import { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { paramOf } from '../lib/companyGuard';

// ─── C15 — إشعارات المستخدم ────────────────────────────────────────────────
// كل إشعار مملوك لمستخدم — الملكية تُتحقَّق مباشرة عبر req.auth.sub.

// ─── GET /api/notifications/me ─────────────────────────────────────────────
export const listMyNotifications: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const rows = await prisma.notification.findMany({
      where: { userId: req.auth.sub },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unread = await prisma.notification.count({
      where: { userId: req.auth.sub, read: false },
    });
    res.json({ notifications: rows, unread });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/notifications/:id/read ─────────────────────────────────────
export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new HttpError(404, 'الإشعار غير موجود');
    if (notif.userId !== req.auth.sub) {
      throw new HttpError(403, 'لا تملك صلاحية على هذا الإشعار');
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// دالة داخلية لإنشاء إشعار — تُستدعى من متحكمات أخرى.
export async function createNotification(input: {
  userId: string;
  type: string;
  message: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      message: input.message,
    },
  });
}
