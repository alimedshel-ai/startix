import { RequestHandler } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { DEPT_BANKS, type DeptCode, type DeptBank } from '../lib/deptQuestions';
import {
  scoreAudit,
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
  if (!dept) throw new HttpError(404, 'Department not found');
  return dept;
}

function paramId(req: Parameters<RequestHandler>[0], key: 'id' | 'companyId'): string {
  return (req.params as Record<string, string>)[key];
}

async function assertCompanyAccess(userId: string, companyId: string) {
  const link = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!link) throw new HttpError(403, 'You do not have access to this company');
}

// ─── POST /api/departments — create (idempotent) dept for a company ─────────
export const createDepartment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const variant = (req.query.variant as string) ?? 'basic';
    const bank: DeptBank = DEPT_BANKS[dept.type as DeptCode];
    if (!bank) throw new HttpError(404, 'No question bank for this department');
    const questions = variant === 'pro' && bank.pro ? [...bank.basic, ...bank.pro] : bank.basic;
    res.json({ deptType: dept.type, variant, questions });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/departments/:id/audit — basic audit ──────────────────────────
export const submitDeptAudit: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const body = auditSubmitSchema.parse(req.body);
    const answers: AuditAnswer[] = body.answers;
    const score = scoreBasicAuditFor(dept.type as DeptCode, answers);

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
export const submitDeptAuditPro: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    if (req.auth.plan === 'BASIC') {
      throw new HttpError(402, 'تدقيق Pro يتطلب الباقة الاحترافية', {
        requiredPlan: 'PROFESSIONAL', currentPlan: 'BASIC', upgradeUrl: '/pricing',
      });
    }
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    const body = auditSubmitSchema.parse(req.body);
    const answers: AuditAnswer[] = body.answers;
    const bank = DEPT_BANKS[dept.type as DeptCode];
    if (!bank.pro) throw new HttpError(404, 'No pro audit for this department');
    const score = scoreProAuditFor(dept.type as DeptCode, answers);
    // The pro version also computes detailed per-axis maturity from the basic+pro union.
    const detailed = scoreAudit([...bank.basic, ...bank.pro], answers);

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
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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

// ─── POST /api/departments/:id/smart ────────────────────────────────────────
export const submitDeptSmart: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const dept = await getDeptOr404(paramId(req, 'id'));
    await assertCompanyAccess(req.auth.sub, dept.companyId);
    smartSchema.parse(req.body);

    const audit = await prisma.deptAudit.findFirst({
      where: { departmentId: dept.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!audit) {
      throw new HttpError(409, 'Submit an audit before requesting SMART recommendations');
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
