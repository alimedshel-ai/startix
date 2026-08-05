import { RequestHandler } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import {
  DEPT_BANKS,
  questionsForSizeAndVariant,
  type DeptCode,
  type CompanySize,
} from '../lib/deptQuestions';
import {
  scoreBasicAuditFor,
  scoreProAuditFor,
  type AuditAnswer,
} from '../services/auditEngine';
import { smartRecommendations } from '../services/deptSmartEngine';

const DEPT_CODES = Object.keys(DEPT_BANKS) as DeptCode[];

const answerSchema = z.object({
  questionId: z.string().min(1),
  value: z.string().min(1),
});

const auditSubmitSchema = z.object({
  answers: z.array(answerSchema).min(1),
});

const createDeptSchema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(DEPT_CODES as [DeptCode, ...DeptCode[]]),
  managerId: z.string().uuid().optional(),
});

const smartSchema = z.object({
  metrics: z.record(z.string(), z.number()).optional(),
});

async function getDeptOr404(id: string) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new HttpError(404, 'القسم غير موجود');
  return dept;
}

function paramId(req: Parameters<RequestHandler>[0], key: 'id' | 'companyId'): string {
  return (req.params as Record<string, string>)[key];
}

async function assertCompanyAccess(userId: string, companyId: string) {
  const link = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!link) throw new HttpError(403, 'لا تملك صلاحية الوصول إلى هذه الشركة');
}

// حجم الكيان من DB (مصدر موثوق) — لا يُمرَّر من العميل، فلا سطح تلاعب.
async function companySizeOf(companyId: string): Promise<CompanySize> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { size: true },
  });
  if (!company) throw new HttpError(404, 'الشركة غير موجودة');
  return company.size as CompanySize;
}

// ─── POST /api/departments — create (idempotent) dept for a company ─────────
export const createDepartment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createDeptSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const existing = await prisma.department.findUnique({
      where: { companyId_type: { companyId: body.companyId, type: body.type } },
    });
    if (existing) {
      res.json(existing);
      return;
    }
    try {
      const dept = await prisma.department.create({
        data: {
          companyId: body.companyId,
          type: body.type,
          managerId: body.managerId,
        },
      });
      res.status(201).json(dept);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const found = await prisma.department.findUnique({
          where: { companyId_type: { companyId: body.companyId, type: body.type } },
        });
        if (found) {
          res.json(found);
          return;
        }
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/departments/me/first-company — manager helper ────────────────
export const getMyFirstCompany: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const link = await prisma.companyUser.findFirst({
      where: { userId: req.auth.sub },
      include: { company: true },
      orderBy: { id: 'asc' },
    });
    if (!link) {
      res.json({ company: null });
      return;
    }
    res.json({ company: link.company });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/departments/company/:companyId — list all depts ───────────────
export const listDepartments: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramId(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const depts = await prisma.department.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(depts);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/departments/:id/questions ─────────────────────────────────────
export const getDepartmentQuestions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const variant = (req.query.variant as string) === 'pro' ? 'pro' : 'basic';
    // حدُّ الباقة على الجلب أيضاً (لا الإرسال وحده): بنك pro أصلٌ مدفوع، فلا
    // يُقرأ نصّه لمن دون الاحترافيّة. يوازي requirePlan على POST /audit-pro.
    if (variant === 'pro' && req.auth.plan === 'BASIC') {
      throw new HttpError(402, 'أسئلة التدقيق الاحترافي تتطلب الباقة الاحترافية', {
        requiredPlan: 'PROFESSIONAL', currentPlan: req.auth.plan, upgradeUrl: '/pricing',
      });
    }
    if (!DEPT_BANKS[dept.type as DeptCode]) throw new HttpError(404, 'لا يوجد بنك أسئلة لهذا القسم');
    const size = await companySizeOf(dept.companyId);
    // المصدر الواحد: نفس المجموعة التي سيقيّمها auditEngine (قيد الصحّة).
    const questions = questionsForSizeAndVariant(dept.type as DeptCode, variant, size);
    res.json({ deptType: dept.type, variant, questions });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/departments/:id/audit — basic audit ──────────────────────────
export const submitDeptAudit: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const body = auditSubmitSchema.parse(req.body);
    const answers: AuditAnswer[] = body.answers;
    const size = await companySizeOf(dept.companyId);
    const score = scoreBasicAuditFor(dept.type as DeptCode, answers, size);

    await prisma.$transaction(async (tx) => {
      await tx.deptAudit.create({
        data: {
          departmentId: dept.id,
          auditType: 'basic',
          answers: answers as unknown as object,
          scores: score as unknown as object,
          totalScore: score.total,
          healthPct: score.healthPct,
        },
      });
      await tx.department.update({
        where: { id: dept.id },
        data: { auditScore: score.healthPct, auditData: score as unknown as object },
      });
    });

    res.status(201).json({ deptType: dept.type, score });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/departments/:id/audit-pro — pro audit ────────────────────────
// خطة الحماية: PROFESSIONAL+ عبر requirePlan middleware في routes/departments.ts.
export const submitDeptAuditPro: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const body = auditSubmitSchema.parse(req.body);
    const answers: AuditAnswer[] = body.answers;
    if (!DEPT_BANKS[dept.type as DeptCode].pro) throw new HttpError(404, 'لا يوجد تدقيق Pro لهذا القسم');
    const size = await companySizeOf(dept.companyId);
    // basic+pro مفلتر بالحجم عبر المصدر الواحد؛ detailed هو نفس التقييم (لكل محور).
    const detailed = scoreProAuditFor(dept.type as DeptCode, answers, size);
    const score = detailed;

    await prisma.$transaction(async (tx) => {
      await tx.deptAudit.create({
        data: {
          departmentId: dept.id,
          auditType: 'pro',
          answers: answers as unknown as object,
          scores: detailed as unknown as object,
          totalScore: score.total,
          healthPct: score.healthPct,
        },
      });
      await tx.department.update({
        where: { id: dept.id },
        data: { auditScore: score.healthPct, auditData: detailed as unknown as object },
      });
    });

    res.status(201).json({ deptType: dept.type, score: detailed });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/departments/:id/audit/latest ──────────────────────────────────
export const getLatestDeptAudit: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const audit = await prisma.deptAudit.findFirst({
      where: { departmentId: dept.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!audit) {
      res.json({ deptType: dept.type, audit: null });
      return;
    }
    res.json({ deptType: dept.type, audit });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/departments/:id/audit/history — لمؤشّر التحسّن (قبل→بعد) ────────
export const getDeptAuditHistory: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const history = await prisma.deptAudit.findMany({
      where: { departmentId: dept.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { healthPct: true, totalScore: true, createdAt: true },
    });
    res.json({ deptType: dept.type, history });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/departments/:id/smart ────────────────────────────────────────
export const submitDeptSmart: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    smartSchema.parse(req.body);

    const audit = await prisma.deptAudit.findFirst({
      where: { departmentId: dept.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!audit) {
      throw new HttpError(409, 'أرسل تدقيقاً قبل طلب توصيات SMART');
    }
    const score = audit.scores as unknown as Parameters<typeof smartRecommendations>[1];
    const recs = smartRecommendations(dept.type as DeptCode, score);

    await prisma.department.update({
      where: { id: dept.id },
      data: {
        smartData: recs as unknown as object,
        kpiData: { kpis: recs.kpis } as unknown as object,
      },
    });

    res.json({ deptType: dept.type, recommendations: recs });
  } catch (err) {
    next(err);
  }
};
