import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

const entitySize = z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']);

// R4 — OPEX schema يُستخدم في create + update. كل الحقول اختيارية —
// المدير يُثري تدريجياً حسب ما يعرف.
const opexSchema = z.object({
  team: z.number().int().min(0).max(100000).optional(),
  budget: z.number().min(0).optional(),
  target: z.number().min(0).optional(),
  avgSalary: z.number().min(0).optional(),
}).optional();

// تعريف العميل (اختياريّ بالكامل) — نوع الخدمة/التسعير/العملاء. يُغذّي التحليل.
const profileSchema = z.object({
  serviceType: z.string().max(120).optional(),
  pricingModel: z.array(z.string().max(40)).max(6).optional(),  // متعدّد
  customerType: z.string().max(40).optional(),
  // إشارات الوضع/النطاق/الهيكل — كلّها اختياريّة (تخزين فقط الآن).
  trajectory: z.string().max(40).optional(),
  runway: z.string().max(40).optional(),
  marketScope: z.string().max(40).optional(),
  geoSpread: z.string().max(40).optional(),
  deptCount: z.string().max(40).optional(),
  systemsMaturity: z.string().max(40).optional(),
}).optional();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  sector: z.string().min(1).max(80).optional(),
  // R1/R4 — حقول التسجيل الغنيّة على الشركة.
  subsector: z.string().min(1).max(80).optional(),
  entityType: z.string().min(1).max(40).optional(),
  opex: opexSchema,
  profile: profileSchema,
  size: entitySize,
  stage: z.string().min(1).max(80).optional(),
  country: z.string().min(2).max(2).optional(),
  logoUrl: z.string().url().optional(),
});

const updateSchema = createSchema.partial();

// ─── GET /api/companies — list companies the caller belongs to ──────────────
export const listCompanies: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const links = await prisma.companyUser.findMany({
      where: { userId: req.auth.sub },
      include: { company: true },
      orderBy: { id: 'asc' },
    });
    res.json(links.map((l) => ({ ...l.company, role: l.role })));
  } catch (err) { next(err); }
};

// ─── GET /api/companies/:id ────────────────────────────────────────────────
export const getCompany: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertCompanyAccess(req.auth.sub, id);
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new HttpError(404, 'الشركة غير موجودة');
    res.json(company);
  } catch (err) { next(err); }
};

// ─── POST /api/companies — create + auto-link as owner ─────────────────────
export const createCompany: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: body.name,
          sector: body.sector,
          subsector: body.subsector,
          entityType: body.entityType,
          opex: body.opex ?? undefined,
          profile: body.profile ?? undefined,
          size: body.size,
          stage: body.stage,
          country: body.country ?? 'SA',
          logoUrl: body.logoUrl,
        },
      });
      await tx.companyUser.create({
        data: { userId: req.auth!.sub, companyId: company.id, role: 'owner' },
      });
      return company;
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
};

// ─── PATCH /api/companies/:id ──────────────────────────────────────────────
export const updateCompany: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertCompanyAccess(req.auth.sub, id);
    const body = updateSchema.parse(req.body);
    const company = await prisma.company.update({ where: { id }, data: body });
    res.json(company);
  } catch (err) { next(err); }
};

// ─── DELETE /api/companies/:id ─────────────────────────────────────────────
export const deleteCompany: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    // Only an owner-role link may delete the company.
    const link = await prisma.companyUser.findUnique({
      where: { userId_companyId: { userId: req.auth.sub, companyId: id } },
    });
    if (!link) throw new HttpError(403, 'لا تملك صلاحية الوصول إلى هذه الشركة');
    if (link.role !== 'owner') throw new HttpError(403, 'صلاحية الحذف للمالك فقط');
    await prisma.company.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};
