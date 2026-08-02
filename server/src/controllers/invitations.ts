import { RequestHandler } from 'express';
import crypto from 'crypto';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';
import { sendEmail } from '../lib/ses';
import { createNotification } from './notifications';

// ─── C15 — دعوات الانضمام لشركة ────────────────────────────────────────────
// المُنشئ يجب أن يملك صلاحية على الشركة. القبول لأي مستخدم مصادَق بريده
// يطابق email المدعو، خلال expiresAt، والحالة pending.
// البريد يُرسل عبر ses.sendEmail — يتحلل بأمان بلا مفاتيح (يطبع الرسالة).

const createSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  role: z.enum(['owner', 'manager', 'member']),
  /** أيام صلاحية الرمز — افتراضي 7. */
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

// رتبة الدور — تُستعمل لمنع تصعيد الصلاحيات: لا يدعو أحدٌ بدورٍ أعلى من دوره،
// والعضو (member) لا يدعو إطلاقاً. (SEC — يقفل ثغرة رفع النفس إلى owner.)
const ROLE_RANK: Record<string, number> = { member: 1, manager: 2, owner: 3 };

// ─── POST /api/invitations ─────────────────────────────────────────────────
export const createInvitation: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createSchema.parse(req.body);
    // صلاحية الدعوة تتطلّب دوراً فعلياً على الشركة، لا مجرّد ارتباط.
    const link = await prisma.companyUser.findUnique({
      where: { userId_companyId: { userId: req.auth.sub, companyId: body.companyId } },
    });
    if (!link) throw new HttpError(403, 'لا تملك صلاحية الوصول إلى هذه الشركة.');
    const inviterRank = ROLE_RANK[link.role] ?? 0;
    if (inviterRank < ROLE_RANK.manager) {
      throw new HttpError(403, 'فقط المالك أو المدير يمكنه إرسال الدعوات.');
    }
    if ((ROLE_RANK[body.role] ?? 0) > inviterRank) {
      throw new HttpError(403, 'لا يمكنك دعوة عضو بدورٍ أعلى من دورك.');
    }

    // ألغِ أي دعوة سابقة قيد الانتظار لنفس البريد على نفس الشركة (تفادي التكرار).
    await prisma.invitation.updateMany({
      where: { companyId: body.companyId, email: body.email, status: 'pending' },
      data: { status: 'revoked' },
    });

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        companyId: body.companyId,
        email: body.email,
        role: body.role,
        token,
        expiresAt,
      },
    });

    // ابنِ رابط القبول لعرضه في البريد.
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    const acceptUrl = `${clientUrl}/invitations/accept?token=${token}`;

    const company = await prisma.company.findUnique({ where: { id: body.companyId } });
    const companyName = company?.name ?? 'شركتنا';

    await sendEmail({
      to: body.email,
      subject: `دعوة للانضمام إلى ${companyName} على ستارتكس`,
      text: `تمّت دعوتك للانضمام إلى ${companyName} بدور ${body.role}.\nاقبل الدعوة عبر:\n${acceptUrl}\n\nالرابط ينتهي خلال ${body.expiresInDays} أيام.`,
      html: `<p>تمّت دعوتك للانضمام إلى <strong>${companyName}</strong> بدور <em>${body.role}</em>.</p><p><a href="${acceptUrl}">اقبل الدعوة</a></p><p>الرابط ينتهي خلال ${body.expiresInDays} أيام.</p>`,
    });

    // إن كان للمدعو حساب أصلاً، أضف إشعاراً داخل التطبيق أيضاً.
    const existingUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (existingUser) {
      await createNotification({
        userId: existingUser.id,
        type: 'invitation_received',
        message: `دعوة للانضمام إلى ${companyName} بدور ${body.role}`,
      });
    }

    res.status(201).json(invitation);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/invitations/company/:companyId — قائمة دعوات شركة ────────────
export const listCompanyInvitations: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.invitation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ─── نقيّة: نوع المدير بعد قبول دعوة — تفصل قرار الهويّة عن كتابة prisma ──────
// ق١+ق٣: دور «manager» يجعل مديرَ الشركة داخليّاً (INTERNAL) فيرث سياق شركة المالك
// (companyId عبر CompanyUser) وتُطلَق شارة fromOwner (goalSource.ts:17). الحرّاس:
//   • دور غير «manager» → لا تغيير.
//   • userType ≠ MANAGER → لا تغيير (تفادي تركيبة OWNER/INVESTOR + INTERNAL غير
//     المتّسقة — managerType لا معنى له إلا لمدير).
//   • INDEPENDENT_PRO → لا يُدهَس (يبقى مستقلّاً).
// تُرجِع managerType الجديد، أو null = «لا تغيير».
export function managerTypeAfterAccept(
  invitationRole: string,
  user: { userType: string; managerType: string | null },
): 'INTERNAL' | null {
  if (invitationRole !== 'manager') return null;
  if (user.userType !== 'MANAGER') return null;
  if (user.managerType === 'INDEPENDENT_PRO') return null;
  return 'INTERNAL';
}

// ─── POST /api/invitations/:token/accept ───────────────────────────────────
export const acceptInvitation: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const token = paramOf(req, 'token');
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new HttpError(404, 'الدعوة غير موجودة');
    if (invitation.status !== 'pending') {
      throw new HttpError(400, 'الدعوة غير متاحة للقبول (منتهية أو مقبولة أو مُلغاة)');
    }
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new HttpError(400, 'انتهت صلاحية الدعوة');
    }

    // يجب أن يطابق بريد المستخدم بريد الدعوة.
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) throw new HttpError(401, 'الحساب غير موجود');
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new HttpError(403, 'بريد الحساب لا يطابق بريد الدعوة');
    }

    // أنشئ CompanyUser link إن لم يكن موجوداً، وحدّث حالة الدعوة.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.companyUser.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: invitation.companyId } },
      });
      if (!existing) {
        await tx.companyUser.create({
          data: {
            userId: user.id,
            companyId: invitation.companyId,
            role: invitation.role,
          },
        });
      }
      // ق١+ق٣: الدعوة هي مصدر المدير الداخليّ (لا التسجيل الذاتيّ). القرار نقيّ
      // في managerTypeAfterAccept (مُختبَر معزولاً) — هنا الكتابة فقط.
      const nextManagerType = managerTypeAfterAccept(invitation.role, user);
      if (nextManagerType) {
        await tx.user.update({
          where: { id: user.id },
          data: { managerType: nextManagerType },
        });
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      });
    });

    const company = await prisma.company.findUnique({ where: { id: invitation.companyId } });
    await createNotification({
      userId: user.id,
      type: 'invitation_accepted',
      message: `انضممت إلى ${company?.name ?? 'الشركة'} بدور ${invitation.role}`,
    });

    res.json({ ok: true, companyId: invitation.companyId, role: invitation.role });
  } catch (err) {
    next(err);
  }
};
