import { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';

// ─── PRO-B — قائمة عملاء المدير المستقل ────────────────────────────────────
// endpoints مخصّصة لمسار المدير المستقل (INDEPENDENT_PRO).
// يخدم عدّة عملاء عبر إدارة واحدة (تخصّصه).

// ─── GET /api/pro/clients ───────────────────────────────────────────────────
// يرجّع لكل شركة يعمل فيها المدير: بيانات الشركة + إدارة تخصّصه (لو وُجدت) +
// آخر تدقيق لتلك الإدارة (لو وُجد). لا يشمل الشركات التي بلا CompanyUser link.
export const listMyClients: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');

    const user = await prisma.user.findUnique({
      where: { id: req.auth.sub },
      select: {
        id: true,
        userType: true,
        managerType: true,
        specialtyDeptType: true,
      },
    });
    if (!user) throw new HttpError(401, 'الحساب غير موجود');
    if (user.userType !== 'MANAGER' || user.managerType !== 'INDEPENDENT_PRO') {
      throw new HttpError(403, 'هذا المسار مخصّص للمدير المستقل فقط');
    }
    if (!user.specialtyDeptType) {
      throw new HttpError(400, 'حسابك بدون تخصّص — حدّث ملفك الشخصي أولاً');
    }

    const specialty = user.specialtyDeptType;
    const links = await prisma.companyUser.findMany({
      where: { userId: user.id },
      include: { company: true },
      orderBy: { id: 'desc' },
    });

    const clients = await Promise.all(
      links.map(async (link) => {
        const dept = await prisma.department.findUnique({
          where: { companyId_type: { companyId: link.companyId, type: specialty } },
          include: {
            audits: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        });
        const latest = dept?.audits[0];
        // dangerZone يعيش داخل scores: Json — استخرجه بحذر.
        const rawScores = (latest?.scores ?? null) as { dangerZone?: string } | null;
        const zone = rawScores?.dangerZone;
        const dangerZone: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | null =
          zone === 'GREEN' || zone === 'YELLOW' || zone === 'ORANGE' || zone === 'RED'
            ? zone
            : null;
        return {
          company: {
            id: link.company.id,
            name: link.company.name,
            sector: link.company.sector,
            size: link.company.size,
            stage: link.company.stage,
          },
          role: link.role,
          department: dept ? { id: dept.id, type: dept.type } : null,
          latestAudit: latest
            ? {
                id: latest.id,
                auditType: latest.auditType,
                healthPct: latest.healthPct,
                dangerZone,
                createdAt: latest.createdAt,
              }
            : null,
        };
      })
    );

    res.json({ specialty, clients });
  } catch (err) {
    next(err);
  }
};
