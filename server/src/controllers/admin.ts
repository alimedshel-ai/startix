import { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';

/**
 * System-wide statistics for the admin dashboard. Returns aggregates only —
 * no per-row data. Any authenticated user can call it today; restricting
 * to a future ADMIN role can be layered on later.
 */
export const adminStats: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');

    const since30 = new Date(Date.now() - 30 * 86400000);

    const [
      userCount,
      planCounts,
      typeCounts,
      companyCount,
      activeCompanies,
      diagnosticsLast30,
      auditsLast30,
      reportsLast30,
      objectiveCount,
      kpiCount,
      kpiEntriesLast30,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['plan'], _count: true }),
      prisma.user.groupBy({ by: ['userType'], _count: true }),
      prisma.company.count(),
      prisma.diagnostic.findMany({
        where: { createdAt: { gte: since30 } },
        select: { companyId: true },
        distinct: ['companyId'],
      }).then((rows) => rows.length),
      prisma.diagnostic.count({ where: { createdAt: { gte: since30 } } }),
      prisma.deptAudit.count({ where: { createdAt: { gte: since30 } } }),
      prisma.report.count({ where: { createdAt: { gte: since30 } } }),
      prisma.objective.count(),
      prisma.kPI.count(),
      prisma.kPIEntry.count({ where: { enteredAt: { gte: since30 } } }),
    ]);

    const plans = Object.fromEntries(planCounts.map((p) => [p.plan, p._count]));
    const types = Object.fromEntries(typeCounts.map((t) => [t.userType, t._count]));

    res.json({
      users: { total: userCount, byPlan: plans, byType: types },
      companies: { total: companyCount, activeLast30Days: activeCompanies },
      activity: {
        diagnosticsLast30,
        auditsLast30,
        reportsLast30,
        kpiEntriesLast30,
      },
      content: {
        objectives: objectiveCount,
        kpis: kpiCount,
      },
    });
  } catch (err) {
    next(err);
  }
};
