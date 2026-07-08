import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { paramOf } from '../lib/companyGuard';

// ─── C14 — صفقات المستثمر ───────────────────────────────────────────────────
// خط أنابيب مبسّط: صفقة = شركة هدف باسم حرّ + قطاع + مرحلة + تقييم + حالة.
// الملكية شخصية للمستثمر — لا `assertCompanyAccess`، بل تحقّق مباشرة أن
// المستخدم هو `investorUserId`.
//
// اعتبار MVP (من الخطة): الصفقات منفصلة عن شبكة الشركات القابلة للنقر —
// PortfolioPage/CompanyDetailPage تبقيان على listMyCompanies.

const dealStatusEnum = z.enum(['lead', 'due_diligence', 'term_sheet', 'closed_won', 'closed_lost']);

const createSchema = z.object({
  targetCompanyName: z.string().min(1).max(200),
  sector: z.string().max(80).optional(),
  stage: z.string().max(80).optional(),
  valuation: z.number().nonnegative().finite().optional(),
  status: dealStatusEnum.optional(),
});

const updateSchema = z.object({
  targetCompanyName: z.string().min(1).max(200).optional(),
  sector: z.string().max(80).nullable().optional(),
  stage: z.string().max(80).nullable().optional(),
  valuation: z.number().nonnegative().finite().nullable().optional(),
  status: dealStatusEnum.optional(),
});

async function assertDealOwnership(dealId: string, userId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new HttpError(404, 'الصفقة غير موجودة');
  if (deal.investorUserId !== userId) throw new HttpError(403, 'لا تملك صلاحية الوصول لهذه الصفقة');
  return deal;
}

// ─── GET /api/deals — قائمة صفقات المستثمر ─────────────────────────────────
export const listDeals: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const rows = await prisma.deal.findMany({
      where: { investorUserId: req.auth.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/deals ───────────────────────────────────────────────────────
export const createDeal: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createSchema.parse(req.body);
    const row = await prisma.deal.create({
      data: {
        investorUserId: req.auth.sub,
        targetCompanyName: body.targetCompanyName,
        sector: body.sector,
        stage: body.stage,
        valuation: body.valuation,
        status: body.status ?? 'lead',
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/deals/:id ──────────────────────────────────────────────────
export const updateDeal: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertDealOwnership(id, req.auth.sub);
    const body = updateSchema.parse(req.body);
    const row = await prisma.deal.update({ where: { id }, data: body });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/deals/:id ─────────────────────────────────────────────────
export const deleteDeal: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertDealOwnership(id, req.auth.sub);
    await prisma.deal.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
