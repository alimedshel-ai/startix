import { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';

// ─── endpoints مسار المدير المستقل (INDEPENDENT_PRO) ────────────────────────
// المدير المستقل يخدم عدّة عملاء عبر إدارة واحدة (تخصّصه). كل الطلبات هنا
// مقيّدة على userType=MANAGER + managerType=INDEPENDENT_PRO + specialtyDeptType.

type DangerZone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

// استخراج dangerZone الآمن من DeptAudit.scores (Json).
function parseZone(scores: unknown): DangerZone | null {
  if (!scores || typeof scores !== 'object') return null;
  const raw = (scores as { dangerZone?: unknown }).dangerZone;
  return raw === 'GREEN' || raw === 'YELLOW' || raw === 'ORANGE' || raw === 'RED' ? raw : null;
}

// حارس مشترك — يُرجع (userId, specialty) أو يرمي HttpError مناسب.
async function assertPro(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) throw new HttpError(401, 'غير مصادق');
  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
    select: { id: true, userType: true, managerType: true, specialtyDeptType: true },
  });
  if (!user) throw new HttpError(401, 'الحساب غير موجود');
  if (user.userType !== 'MANAGER' || user.managerType !== 'INDEPENDENT_PRO') {
    throw new HttpError(403, 'هذا المسار مخصّص للمدير المستقل فقط');
  }
  if (!user.specialtyDeptType) {
    throw new HttpError(400, 'حسابك بدون تخصّص — حدّث ملفك الشخصي أولاً');
  }
  return { userId: user.id, specialty: user.specialtyDeptType };
}

// ─── GET /api/pro/clients (PRO-B) ──────────────────────────────────────────
// قائمة مبسّطة — بيانات الشركة + آخر تدقيق فقط. يخدم كروت "عملائي" السابقة.
// للمقاييس/الرؤى/التنبيهات استعمل /api/pro/overview أدناه.
export const listMyClients: RequestHandler = async (req, res, next) => {
  try {
    const { userId, specialty } = await assertPro(req);

    const links = await prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { id: 'desc' },
    });

    const clients = await Promise.all(
      links.map(async (link) => {
        const dept = await prisma.department.findUnique({
          where: { companyId_type: { companyId: link.companyId, type: specialty } },
          include: { audits: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        const latest = dept?.audits[0];
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
                dangerZone: parseZone(latest.scores),
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

// ─── GET /api/pro/overview (PRO-2) ─────────────────────────────────────────
// تجميع موحّد في طلب واحد يخدم لوحة "محفظتي" الغنيّة + جدول المقارنة +
// شارات التنبيه. يعيد:
//   clients[]: صفحة العميل (healthPct, dangerZone, delta بين آخر تدقيقين)
//   summary:   إحصاءات المحفظة (total, avgHealth, distribution, staleCount, redCount, unaudited)
//   insights[]: ٦ قواعد ذكية عربية
//   alerts[]: تنبيهات تراجع صحة > 15%
// كل الحسابات في السيرفر — الكلاينت يستهلك الاستجابة كما هي، بلا حلقات تجميع.
const STALE_THRESHOLD_DAYS = 30;
const DECLINE_ALERT_DELTA = 15;
const PRACTICE_GAP_MIN_DELTA = 30;
const EXPANSION_READY_MIN_HEALTH = 70;
const RED_CONCENTRATION_MIN = 2;

interface OverviewClient {
  companyId: string;
  companyName: string;
  sector: string | null;
  size: string;
  stage: string | null;
  specialty: string;
  hasDepartment: boolean;
  hasAnyAudit: boolean;
  healthPct: number | null;
  dangerZone: DangerZone | null;
  lastAuditAt: string | null;
  latestHealthPct: number | null;
  previousHealthPct: number | null;
  delta: number | null;
  daysSinceLastAudit: number | null;
  isStale: boolean;
}

interface OverviewSummary {
  total: number;
  avgHealth: number | null;
  distribution: { GREEN: number; YELLOW: number; ORANGE: number; RED: number; NONE: number };
  staleCount: number;
  redCount: number;
  unaudited: number;
}

interface OverviewInsight {
  code: string;
  severity: 'info' | 'warning' | 'critical' | 'positive';
  message: string;
  affectedClientIds?: string[];
}

interface OverviewAlert {
  code: 'health_decline';
  companyId: string;
  companyName: string;
  delta: number;
  previousHealthPct: number;
  latestHealthPct: number;
}

export const getProOverview: RequestHandler = async (req, res, next) => {
  try {
    const { userId, specialty } = await assertPro(req);

    const links = await prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { id: 'desc' },
    });

    const now = Date.now();
    const clients: OverviewClient[] = await Promise.all(
      links.map(async (link): Promise<OverviewClient> => {
        const dept = await prisma.department.findUnique({
          where: { companyId_type: { companyId: link.companyId, type: specialty } },
          include: { audits: { orderBy: { createdAt: 'desc' }, take: 2 } },
        });
        const audits = dept?.audits ?? [];
        const latest = audits[0] ?? null;
        const previous = audits[1] ?? null;
        const healthPct = latest ? Math.round(latest.healthPct) : null;
        const prevHealthPct = previous ? Math.round(previous.healthPct) : null;
        const delta = healthPct != null && prevHealthPct != null ? prevHealthPct - healthPct : null;
        const daysSince = latest
          ? Math.floor((now - new Date(latest.createdAt).getTime()) / 86_400_000)
          : null;
        return {
          companyId: link.company.id,
          companyName: link.company.name,
          sector: link.company.sector,
          size: link.company.size,
          stage: link.company.stage,
          specialty,
          hasDepartment: dept != null,
          hasAnyAudit: latest != null,
          healthPct,
          dangerZone: parseZone(latest?.scores ?? null),
          lastAuditAt: latest ? latest.createdAt.toISOString() : null,
          latestHealthPct: healthPct,
          previousHealthPct: prevHealthPct,
          delta,
          daysSinceLastAudit: daysSince,
          isStale: daysSince != null && daysSince > STALE_THRESHOLD_DAYS,
        };
      })
    );

    // ─── summary ───────────────────────────────────────────────────────────
    const audited = clients.filter((c) => c.healthPct != null);
    const distribution = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, NONE: 0 };
    for (const c of clients) {
      const zone = c.dangerZone ?? 'NONE';
      distribution[zone] += 1;
    }
    const avgHealth =
      audited.length > 0
        ? Math.round(audited.reduce((sum, c) => sum + (c.healthPct ?? 0), 0) / audited.length)
        : null;
    const summary: OverviewSummary = {
      total: clients.length,
      avgHealth,
      distribution,
      staleCount: clients.filter((c) => c.isStale).length,
      redCount: distribution.RED,
      unaudited: clients.filter((c) => !c.hasAnyAudit).length,
    };

    // ─── insights (٦ قواعد) ────────────────────────────────────────────────
    const insights: OverviewInsight[] = [];

    // ١. محفظة صفرية — أعلى أولوية للعرض.
    if (summary.total === 0) {
      insights.push({
        code: 'empty_portfolio',
        severity: 'info',
        message: 'لا يوجد لديك عملاء بعد — أضِف أوّل عميل لبدء العمل.',
      });
    }

    // ٢. بلا تدقيق إطلاقاً.
    if (summary.unaudited > 0) {
      const ids = clients.filter((c) => !c.hasAnyAudit).map((c) => c.companyId);
      insights.push({
        code: 'no_audit_yet',
        severity: 'info',
        message:
          summary.unaudited === 1
            ? 'عميل واحد لم تُجرِ له تدقيقاً بعد — ابدأ به لتظهر مؤشّراته.'
            : `${summary.unaudited} عملاء لم يُجرَ لهم تدقيق بعد — ابدأ بأحدهم.`,
        affectedClientIds: ids,
      });
    }

    // ٣. تغطية ناقصة (stale > 30 يوم).
    if (summary.staleCount > 0) {
      const ids = clients.filter((c) => c.isStale).map((c) => c.companyId);
      insights.push({
        code: 'stale_coverage',
        severity: 'warning',
        message: `${summary.staleCount} عملاء لم يُحدَّث تدقيقهم منذ أكثر من ${STALE_THRESHOLD_DAYS} يوماً — أعِد تقييمهم للحفاظ على دقّة الرؤى.`,
        affectedClientIds: ids,
      });
    }

    // ٤. تركّز الخطر (RED >= 2).
    if (summary.redCount >= RED_CONCENTRATION_MIN) {
      const ids = clients.filter((c) => c.dangerZone === 'RED').map((c) => c.companyId);
      insights.push({
        code: 'risk_concentration',
        severity: 'critical',
        message: `${summary.redCount} عملاء في المنطقة الحمراء — تدخّل عاجل مطلوب.`,
        affectedClientIds: ids,
      });
    }

    // ٥. فجوة الممارسات (max - min > 30).
    if (audited.length >= 2) {
      const healths = audited.map((c) => c.healthPct as number);
      const max = Math.max(...healths);
      const min = Math.min(...healths);
      if (max - min > PRACTICE_GAP_MIN_DELTA) {
        insights.push({
          code: 'practice_gap',
          severity: 'warning',
          message: `فجوة ممارسات كبيرة (${max}% ↔ ${min}%) — انقل ما يعمل من الأعلى إلى الأدنى.`,
        });
      }
    }

    // ٦. جاهزية التوسّع (كل صحّة ≥ 70 + صفر RED + عدد ≥ 2).
    if (
      audited.length >= 2 &&
      summary.redCount === 0 &&
      audited.every((c) => (c.healthPct ?? 0) >= EXPANSION_READY_MIN_HEALTH)
    ) {
      insights.push({
        code: 'expansion_ready',
        severity: 'positive',
        message: 'كل عملائك في حالة صحّية جيّدة — جاهز لاستقبال عملاء جدد.',
      });
    }

    // ─── alerts (تراجع صحة > 15%) ─────────────────────────────────────────
    const alerts: OverviewAlert[] = clients
      .filter(
        (c) =>
          c.delta != null &&
          c.delta > DECLINE_ALERT_DELTA &&
          c.previousHealthPct != null &&
          c.latestHealthPct != null
      )
      .map((c) => ({
        code: 'health_decline' as const,
        companyId: c.companyId,
        companyName: c.companyName,
        delta: c.delta as number,
        previousHealthPct: c.previousHealthPct as number,
        latestHealthPct: c.latestHealthPct as number,
      }));

    res.json({ specialty, clients, summary, insights, alerts });
  } catch (err) {
    next(err);
  }
};
