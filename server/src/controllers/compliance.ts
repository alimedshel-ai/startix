import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import {
  COMPLIANCE_AXES,
  COMPLIANCE_PRO_QUESTIONS,
  KO_LICENSES,
  activeAxesForSector,
} from '../lib/complianceQuestions';
import { DEPT_BANKS } from '../lib/deptQuestions';
import {
  scoreComplianceBasic,
  scoreCompliancePro,
  type ComplianceBasicAnswer,
  type ComplianceProAnswer,
} from '../services/complianceEngine';

async function getCompanyOr404(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new HttpError(404, 'Company not found');
  return company;
}

async function assertCompanyAccess(userId: string, companyId: string) {
  const link = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!link) throw new HttpError(403, 'You do not have access to this company');
}

const basicAnswer = z.object({
  questionId: z.string().min(1),
  value: z.enum(['none', 'partial', 'good', 'great']),
});

const basicSubmit = z.object({
  answers: z.array(basicAnswer).min(1),
});

const koInput = z.object({
  key: z.string().min(1),
  expiresAt: z.string().nullable(),
});

const proSubmit = z.object({
  answers: z.array(basicAnswer).min(1),
  koLicenses: z.array(koInput).optional(),
});

// ─── GET /api/compliance/:companyId/questions ───────────────────────────────
export const getComplianceQuestions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const company = await getCompanyOr404((req.params as { companyId: string }).companyId);
    await assertCompanyAccess(req.auth.sub, company.id);

    const variant = (req.query.variant as string) ?? 'basic';
    if (variant === 'pro') {
      const axes = activeAxesForSector(company.sector ?? undefined);
      const axisKeys = new Set(axes.map((a) => a.key));
      const questions = COMPLIANCE_PRO_QUESTIONS.filter((q) => axisKeys.has(q.axis));
      res.json({
        variant: 'pro',
        sector: company.sector,
        entitySize: company.size,
        axes,
        questions,
        koLicenses: KO_LICENSES.filter((lic) => lic.appliesWhen === 'always' || (lic.sectors ?? []).includes((company.sector ?? '').toLowerCase())),
      });
      return;
    }
    res.json({
      variant: 'basic',
      sector: company.sector,
      questions: DEPT_BANKS.COMPLIANCE.basic,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/compliance/:companyId/audit — basic ──────────────────────────
export const submitComplianceBasic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const company = await getCompanyOr404((req.params as { companyId: string }).companyId);
    await assertCompanyAccess(req.auth.sub, company.id);
    const body = basicSubmit.parse(req.body);
    const answers = body.answers as ComplianceBasicAnswer[];
    const result = scoreComplianceBasic(DEPT_BANKS.COMPLIANCE.basic.length, answers);

    const audit = await prisma.complianceAudit.create({
      data: {
        companyId: company.id,
        auditType: 'basic',
        answers: answers as unknown as object,
        axisScores: { basic: result } as unknown as object,
        totalScore: result.rawScore,
        maturityPct: result.maturityPct,
        dangerZone: result.dangerZone,
      },
    });
    res.status(201).json({ result, auditId: audit.id });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/compliance/:companyId/audit-pro ──────────────────────────────
export const submitCompliancePro: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    if (req.auth.plan === 'BASIC') {
      throw new HttpError(402, 'تدقيق الامتثال Pro يتطلب الباقة الاحترافية', {
        requiredPlan: 'PROFESSIONAL', currentPlan: 'BASIC', upgradeUrl: '/pricing',
      });
    }
    const company = await getCompanyOr404((req.params as { companyId: string }).companyId);
    await assertCompanyAccess(req.auth.sub, company.id);
    const body = proSubmit.parse(req.body);

    const result = scoreCompliancePro({
      sector: company.sector ?? undefined,
      entitySize: company.size,
      answers: body.answers as ComplianceProAnswer[],
      koLicenses: body.koLicenses,
    });

    const audit = await prisma.complianceAudit.create({
      data: {
        companyId: company.id,
        auditType: 'pro',
        answers: body.answers as unknown as object,
        axisScores: { axes: result.axes, ko: result.koLicenses } as unknown as object,
        totalScore: result.overallMaturityPct,
        maturityPct: result.overallMaturityPct,
        dangerZone: result.dangerZone,
        riskMatrix: result.riskMatrix as unknown as object,
        reformPlan: result.reformPlan as unknown as object,
        penaltyEstimate: result.penaltyEstimate.estimate,
      },
    });

    res.status(201).json({ result, auditId: audit.id });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/compliance/:companyId/latest ──────────────────────────────────
export const getLatestCompliance: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const company = await getCompanyOr404((req.params as { companyId: string }).companyId);
    await assertCompanyAccess(req.auth.sub, company.id);
    const audit = await prisma.complianceAudit.findFirst({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ audit });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/compliance/meta — axes + KO licenses (no auth on shape) ──────
export const getComplianceMeta: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ axes: COMPLIANCE_AXES, koLicenses: KO_LICENSES });
  } catch (err) {
    next(err);
  }
};
