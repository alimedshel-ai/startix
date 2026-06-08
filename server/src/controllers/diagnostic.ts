import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { calculateOwnerPath } from '../services/diagnosticEngine';
import {
  calculateManagerResult,
  calculateInvestorResult,
  type ManagerAnswers,
  type InvestorAnswers,
} from '../services/managerInvestorEngine';
import {
  WEIGHTED_QUESTIONS,
  type OwnerAnswers,
} from '../lib/diagnosticQuestions';

function valuesOf<Q extends { options: ReadonlyArray<{ value: string }> }>(q: Q): [string, ...string[]] {
  return q.options.map((o) => o.value) as [string, ...string[]];
}

const ownerSchema = z.object({
  companyName: z.string().min(1).max(120),
  sector: z.string().min(1).max(80),
  stage: z.enum(valuesOf(WEIGHTED_QUESTIONS[0])),
  size: z.enum(valuesOf(WEIGHTED_QUESTIONS[1])),
  ownerDependency: z.enum(valuesOf(WEIGHTED_QUESTIONS[2])),
  financialTracking: z.enum(valuesOf(WEIGHTED_QUESTIONS[3])),
  liquidity: z.enum(valuesOf(WEIGHTED_QUESTIONS[4])),
  governance: z.enum(valuesOf(WEIGHTED_QUESTIONS[5])),
  scalability: z.enum(valuesOf(WEIGHTED_QUESTIONS[6])),
  exitStrategy: z.enum(valuesOf(WEIGHTED_QUESTIONS[7])),
});

const ENTITY_SIZE_MAP = {
  micro: 'MICRO',
  small: 'SMALL',
  medium: 'MEDIUM',
  large: 'LARGE',
} as const;

async function ensureCompanyForUser(
  userId: string,
  name: string,
  sector: string,
  size: keyof typeof ENTITY_SIZE_MAP,
  stage: string
) {
  const link = await prisma.companyUser.findFirst({
    where: { userId },
    include: { company: true },
    orderBy: { id: 'desc' },
  });
  if (link?.company) {
    return prisma.company.update({
      where: { id: link.companyId },
      data: { name, sector, size: ENTITY_SIZE_MAP[size], stage },
    });
  }
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name,
        sector,
        size: ENTITY_SIZE_MAP[size],
        stage,
      },
    });
    await tx.companyUser.create({
      data: { userId, companyId: company.id, role: 'owner' },
    });
    return company;
  });
}

// نقطة عامة بدون auth لمعاينة نتيجة التشخيص قبل التسجيل.
// نفس منطق التقييم — لكن لا تكتب على قاعدة البيانات.
export const previewOwnerDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    const answers = ownerSchema.parse(req.body) as OwnerAnswers;
    const result = calculateOwnerPath(answers);
    res.json({ result });
  } catch (err) {
    next(err);
  }
};

const managerPreviewSchema = z.object({
  departmentType: z.enum([
    'HR', 'FINANCE', 'SALES', 'MARKETING', 'OPERATIONS', 'IT',
    'CUSTOMER_SERVICE', 'SUPPORT', 'LOGISTICS', 'QUALITY',
    'PROJECTS', 'GOVERNANCE', 'COMPLIANCE',
  ]),
  teamSize: z.enum(['micro', 'small', 'medium', 'large']),
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'expert']),
  operationalMaturity: z.enum(['none', 'partial', 'good', 'great']),
  toolingMaturity: z.enum(['none', 'basic', 'modern', 'advanced']),
  reportingQuality: z.enum(['none', 'partial', 'good', 'great']),
  decisionAuthority: z.enum(['operational', 'tactical', 'strategic']),
});

export const previewManagerDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    const answers = managerPreviewSchema.parse(req.body) as ManagerAnswers;
    const result = calculateManagerResult(answers);
    res.json({ result });
  } catch (err) {
    next(err);
  }
};

const investorPreviewSchema = z.object({
  portfolioSize: z.enum(['1', '2-5', '6-15', '16+']),
  investmentStage: z.enum(['seed', 'early', 'growth', 'late']),
  monitoringCadence: z.enum(['monthly', 'quarterly', 'annual']),
  sectorFocus: z.enum(['single', 'diverse', 'opportunistic']),
  involvementType: z.enum(['active_board', 'observer', 'passive']),
  ticketSize: z.enum(['under_100k', '100k_1m', '1m_10m', '10m_plus']),
});

export const previewInvestorDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    const answers = investorPreviewSchema.parse(req.body) as InvestorAnswers;
    const result = calculateInvestorResult(answers);
    res.json({ result });
  } catch (err) {
    next(err);
  }
};

export const submitOwnerDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    if (req.auth.userType !== 'OWNER') {
      throw new HttpError(403, 'تشخيص المالك متاح فقط لحسابات المالك');
    }
    const answers = ownerSchema.parse(req.body) as OwnerAnswers;

    const company = await ensureCompanyForUser(
      req.auth.sub,
      answers.companyName,
      answers.sector,
      answers.size,
      answers.stage
    );

    const result = calculateOwnerPath(answers);

    const diagnostic = await prisma.diagnostic.create({
      data: {
        userId: req.auth.sub,
        companyId: company.id,
        type: 'OWNER',
        answers: answers as unknown as object,
        strategicPath: result.strategicPath,
        maturityScore: result.maturityScore,
        radarData: result.radarData as unknown as object,
        weaknesses: result.weaknesses as unknown as object,
        roadmap: result.roadmap as unknown as object,
        scenarios: result.scenarios as unknown as object,
      },
    });

    res.status(201).json({ company: { id: company.id, name: company.name }, diagnostic, result });
  } catch (err) {
    next(err);
  }
};

const managerSchema = z.object({
  companyName: z.string().min(1).max(120).optional(),
  departmentType: z.enum([
    'HR', 'FINANCE', 'SALES', 'MARKETING', 'OPERATIONS', 'IT',
    'CUSTOMER_SERVICE', 'SUPPORT', 'LOGISTICS', 'QUALITY',
    'PROJECTS', 'GOVERNANCE', 'COMPLIANCE',
  ]),
  teamSize: z.enum(['micro', 'small', 'medium', 'large']),
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'expert']),
  operationalMaturity: z.enum(['none', 'partial', 'good', 'great']),
  toolingMaturity: z.enum(['none', 'basic', 'modern', 'advanced']),
  reportingQuality: z.enum(['none', 'partial', 'good', 'great']),
  decisionAuthority: z.enum(['operational', 'tactical', 'strategic']),
});

export const submitManagerDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    if (req.auth.userType !== 'MANAGER') {
      throw new HttpError(403, 'تشخيص المدير متاح فقط لحسابات المدير');
    }
    const answers = managerSchema.parse(req.body);

    let company = await prisma.companyUser
      .findFirst({ where: { userId: req.auth.sub }, include: { company: true } })
      .then((l) => l?.company ?? null);

    if (!company) {
      const name = answers.companyName ?? 'My department';
      company = await prisma.$transaction(async (tx) => {
        const c = await tx.company.create({
          data: { name, size: 'SMALL' },
        });
        await tx.companyUser.create({
          data: { userId: req.auth!.sub, companyId: c.id, role: 'manager' },
        });
        return c;
      });
    }

    const diagnostic = await prisma.diagnostic.create({
      data: {
        userId: req.auth.sub,
        companyId: company.id,
        type: 'MANAGER',
        answers: answers as unknown as object,
      },
    });

    res.status(201).json({ company: { id: company.id, name: company.name }, diagnostic });
  } catch (err) {
    next(err);
  }
};

const investorSchema = z.object({
  companyName: z.string().min(1).max(120).optional(),
  portfolioSize: z.enum(['1', '2-5', '6-15', '16+']),
  investmentStage: z.enum(['seed', 'early', 'growth', 'late']),
  monitoringCadence: z.enum(['monthly', 'quarterly', 'annual']),
  sectorFocus: z.enum(['single', 'diverse', 'opportunistic']),
  involvementType: z.enum(['active_board', 'observer', 'passive']),
  ticketSize: z.enum(['under_100k', '100k_1m', '1m_10m', '10m_plus']),
});

export const submitInvestorDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    if (req.auth.userType !== 'INVESTOR') {
      throw new HttpError(403, 'تشخيص المستثمر متاح فقط لحسابات المستثمر');
    }
    const answers = investorSchema.parse(req.body);

    let company = await prisma.companyUser
      .findFirst({ where: { userId: req.auth.sub }, include: { company: true } })
      .then((l) => l?.company ?? null);

    if (!company) {
      const name = answers.companyName ?? 'Portfolio';
      company = await prisma.$transaction(async (tx) => {
        const c = await tx.company.create({ data: { name, size: 'SMALL' } });
        await tx.companyUser.create({
          data: { userId: req.auth!.sub, companyId: c.id, role: 'investor' },
        });
        return c;
      });
    }

    const diagnostic = await prisma.diagnostic.create({
      data: {
        userId: req.auth.sub,
        companyId: company.id,
        type: 'INVESTOR',
        answers: answers as unknown as object,
      },
    });

    res.status(201).json({ company: { id: company.id, name: company.name }, diagnostic });
  } catch (err) {
    next(err);
  }
};

export const getLatestDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = (req.params as { companyId: string }).companyId;

    const link = await prisma.companyUser.findFirst({
      where: { userId: req.auth.sub, companyId },
    });
    if (!link) throw new HttpError(404, 'الشركة غير موجودة');

    const latest = await prisma.diagnostic.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) throw new HttpError(404, 'لا يوجد تشخيص مسجّل لهذه الشركة');

    // Owner diagnostics re-compute the full result so the client can rebuild
    // the result page after a refresh without persisting pathScores/breakdown.
    let result: ReturnType<typeof calculateOwnerPath> | null = null;
    if (latest.type === 'OWNER') {
      try {
        result = calculateOwnerPath(latest.answers as unknown as OwnerAnswers);
      } catch {
        result = null;
      }
    }

    res.json({ diagnostic: latest, result });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/diagnostic/me/latest — latest diagnostic for the caller's
// first linked company. Used by the client to rehydrate the result view
// after a page refresh.
export const getMyLatestDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const link = await prisma.companyUser.findFirst({
      where: { userId: req.auth.sub },
      orderBy: { id: 'asc' },
    });
    if (!link) {
      res.json({ diagnostic: null, result: null });
      return;
    }
    const latest = await prisma.diagnostic.findFirst({
      where: { companyId: link.companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      res.json({ diagnostic: null, result: null });
      return;
    }
    let result: ReturnType<typeof calculateOwnerPath> | null = null;
    if (latest.type === 'OWNER') {
      try { result = calculateOwnerPath(latest.answers as unknown as OwnerAnswers); }
      catch { result = null; }
    }
    res.json({ diagnostic: latest, result });
  } catch (err) {
    next(err);
  }
};
