import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';
import { DEPT_LABEL_AR } from '../lib/deptLabels';

// ─── Schemas ────────────────────────────────────────────────────────────────

const REPORT_TYPES = ['strategic', 'compliance', 'department', 'annual', 'executive'] as const;
const generateSchema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(REPORT_TYPES),
  /** Optional department filter for type='department'. */
  departmentId: z.string().uuid().optional(),
});

const REPORT_TITLES: Record<typeof REPORT_TYPES[number], string> = {
  strategic:  'التقرير الاستراتيجي',
  compliance: 'تقرير الامتثال',
  department: 'تقرير الإدارات',
  annual:     'الخطة السنوية',
  executive:  'الملخص التنفيذي',
};

// ─── Snapshot builders ──────────────────────────────────────────────────────

async function buildStrategicReport(companyId: string) {
  const [company, diagnostic, swot, choice, objectives, kpis] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.diagnostic.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
    prisma.sWOT.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' } }),
    prisma.strategicArtifact.findUnique({ where: { companyId_type: { companyId, type: 'CHOICES' } } }),
    prisma.objective.findMany({ where: { companyId }, include: { okrs: true } }),
    prisma.kPI.findMany({ where: { companyId } }),
  ]);

  return {
    company: company ? { name: company.name, sector: company.sector, size: company.size, stage: company.stage } : null,
    diagnostic: diagnostic ? {
      strategicPath: diagnostic.strategicPath,
      maturityScore: diagnostic.maturityScore,
      radarData: diagnostic.radarData,
      weaknesses: diagnostic.weaknesses,
      roadmap: diagnostic.roadmap,
    } : null,
    swot: swot ? {
      strengths: swot.strengths,
      weaknesses: swot.weaknesses,
      opportunities: swot.opportunities,
      threats: swot.threats,
      tows: swot.tows,
    } : null,
    chosenDirection: choice?.data ?? null,
    objectives: objectives.map((o) => ({
      title: o.title,
      type: o.type,
      status: o.status,
      okrs: (o.okrs ?? []).map((k) => ({
        keyResult: k.keyResult,
        targetValue: k.targetValue,
        currentValue: k.currentValue,
        unit: k.unit,
      })),
    })),
    kpis: kpis.map((k) => ({
      name: k.name,
      unit: k.unit,
      targetValue: k.targetValue,
      currentValue: k.currentValue,
      frequency: k.frequency,
    })),
  };
}

async function buildComplianceReport(companyId: string) {
  const [company, latestBasic, latestPro] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.complianceAudit.findFirst({ where: { companyId, auditType: 'basic' }, orderBy: { createdAt: 'desc' } }),
    prisma.complianceAudit.findFirst({ where: { companyId, auditType: 'pro' }, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    company: company ? { name: company.name, size: company.size, sector: company.sector } : null,
    basic: latestBasic ? {
      maturityPct: latestBasic.maturityPct,
      dangerZone: latestBasic.dangerZone,
      totalScore: latestBasic.totalScore,
      createdAt: latestBasic.createdAt,
    } : null,
    pro: latestPro ? {
      maturityPct: latestPro.maturityPct,
      dangerZone: latestPro.dangerZone,
      axisScores: latestPro.axisScores,
      riskMatrix: latestPro.riskMatrix,
      reformPlan: latestPro.reformPlan,
      penaltyEstimate: latestPro.penaltyEstimate,
      createdAt: latestPro.createdAt,
    } : null,
  };
}

async function buildDepartmentReport(companyId: string, departmentId?: string) {
  const depts = await prisma.department.findMany({
    where: { companyId, ...(departmentId ? { id: departmentId } : {}) },
    include: { kpis: true, audits: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  return {
    departments: depts.map((d) => ({
      type: d.type,
      label: DEPT_LABEL_AR[d.type] ?? d.type,
      auditScore: d.auditScore,
      auditData: d.auditData,
      smartData: d.smartData,
      kpis: d.kpis.map((k) => ({
        name: k.name,
        unit: k.unit,
        targetValue: k.targetValue,
        currentValue: k.currentValue,
        frequency: k.frequency,
      })),
      latestAudit: d.audits[0] ? {
        auditType: d.audits[0].auditType,
        totalScore: d.audits[0].totalScore,
        healthPct: d.audits[0].healthPct,
        createdAt: d.audits[0].createdAt,
      } : null,
    })),
  };
}

async function buildAnnualPlanReport(companyId: string) {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [objectives, initiatives, projects, tasks] = await Promise.all([
    prisma.objective.findMany({ where: { companyId }, include: { okrs: true } }),
    prisma.initiative.findMany({ where: { companyId }, include: { projects: true } }),
    prisma.project.findMany({
      where: {
        companyId,
        OR: [
          { startDate: { gte: yearStart, lt: yearEnd } },
          { endDate: { gte: yearStart, lt: yearEnd } },
        ],
      },
    }),
    prisma.task.findMany({
      where: { companyId, dueDate: { gte: yearStart, lt: yearEnd } },
      orderBy: { dueDate: 'asc' },
    }),
  ]);
  return {
    year,
    objectives: objectives.map((o) => ({
      title: o.title,
      type: o.type,
      status: o.status,
      okrsCount: (o.okrs ?? []).length,
    })),
    initiatives: initiatives.map((i) => ({
      title: i.title,
      priority: i.priority,
      status: i.status,
      projectCount: (i.projects ?? []).length,
    })),
    projects: projects.map((p) => ({
      title: p.title,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
    taskCount: tasks.length,
    overdueTasks: tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < new Date()).length,
  };
}

async function buildExecutiveSummary(companyId: string) {
  const [company, diagnostic, depts, kpis, alerts] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.diagnostic.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
    prisma.department.findMany({ where: { companyId } }),
    prisma.kPI.findMany({ where: { companyId } }),
    // Inline alert sketch
    prisma.task.count({ where: { companyId, status: { not: 'done' }, dueDate: { lt: new Date() } } }),
  ]);

  const audited = depts.filter((d) => d.auditScore != null);
  const avgHealth = audited.length === 0 ? 0 : audited.reduce((s, d) => s + (d.auditScore ?? 0), 0) / audited.length;
  const onTrack = kpis.filter((k) => k.targetValue && (k.currentValue / k.targetValue) >= 0.7).length;

  const weaknesses = (diagnostic?.weaknesses as unknown as { label: string; pct: number }[] | null)?.slice(0, 3) ?? [];

  return {
    company: company ? { name: company.name, sector: company.sector, size: company.size, stage: company.stage } : null,
    healthScore: Math.round(avgHealth),
    maturityScore: diagnostic?.maturityScore ?? null,
    strategicPath: diagnostic?.strategicPath ?? null,
    topWeaknesses: weaknesses,
    kpiSummary: { total: kpis.length, onTrack },
    deptSummary: { total: depts.length, audited: audited.length },
    overdueTasks: alerts,
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export const generateReport: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const body = generateSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    let data: unknown;
    switch (body.type) {
      case 'strategic':  data = await buildStrategicReport(body.companyId); break;
      case 'compliance': data = await buildComplianceReport(body.companyId); break;
      case 'department': data = await buildDepartmentReport(body.companyId, body.departmentId); break;
      case 'annual':     data = await buildAnnualPlanReport(body.companyId); break;
      case 'executive':  data = await buildExecutiveSummary(body.companyId); break;
    }

    const report = await prisma.report.create({
      data: {
        companyId: body.companyId,
        type: body.type,
        title: `${REPORT_TITLES[body.type]} — ${new Date().toLocaleDateString('en-US')}`,
        data: data as object,
      },
    });

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

export const listReports: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);

    const rows = await prisma.report.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, title: true, fileUrl: true, createdAt: true },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

export const getReport: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const id = paramOf(req, 'id');
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new HttpError(404, 'Report not found');
    await assertCompanyAccess(req.auth.sub, report.companyId);
    res.json(report);
  } catch (err) {
    next(err);
  }
};

export const deleteReport: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const id = paramOf(req, 'id');
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new HttpError(404, 'Report not found');
    await assertCompanyAccess(req.auth.sub, report.companyId);
    await prisma.report.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/:id/excel — stream xlsx binary ────────────────────────
export const downloadReportExcel: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    const id = paramOf(req, 'id');
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new HttpError(404, 'Report not found');
    await assertCompanyAccess(req.auth.sub, report.companyId);

    // Lazy import to keep cold-start light when this endpoint isn't hit
    const { reportToExcel } = await import('../services/excelExport');
    const buffer = await reportToExcel(report.type, report.title, report.data);

    const safe = report.title.replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(safe)}.xlsx`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};
