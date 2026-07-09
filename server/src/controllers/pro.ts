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

// ─── GET /api/pro/contradictions/:companyId (A4) ───────────────────────────
// تحليل التناقضات بين إدارات شركة عميل واحد. يقارن درجات المحاور الأربعة
// (governance/financial/team/digital) لكل إدارة ويصدر قواعد نوعية:
//   ١. فجوة نضج الفريق  — إدارة قوية (>=70) بجانب إدارة ضعيفة (<=40)
//   ٢. فجوة الرقمنة    — عمل يدوي في إدارة بينما أخرى متطوّرة رقمياً
//   ٣. فجوة الحوكمة    — إدارة ملتزمة بينما أخرى بلا إجراءات
//   ٤. تضاد مالي       — إدارة مالية تقيّم الوضع صحياً بينما أقسام تعاني
//   ٥. اختلال شامل     — فارق ٤٠٪+ في الصحّة الإجمالية بين أفضل وأضعف قسم
//
// كل rule تُنتج insight يشمل: severity + title + description +
// affectedDepts + suggested OKR.

const AXES = ['governance', 'financial', 'team', 'digital'] as const;
type Axis = (typeof AXES)[number];

const AXIS_AR: Record<Axis, string> = {
  governance: 'الحوكمة',
  financial: 'المالية',
  team: 'الفريق',
  digital: 'الرقمي',
};

interface ContradictionInsight {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  affectedDepts: string[];
  suggestedOKR: {
    objective: string;
    keyResults: string[];
    timeline: string;
  };
}

interface DeptSnapshot {
  code: string;
  labelAr: string;
  healthPct: number;
  axes: Record<Axis, number>;
}

function parseAxisScore(scores: unknown, axis: Axis): number | null {
  if (!scores || typeof scores !== 'object') return null;
  const s = (scores as Record<string, unknown>)[axis];
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  return null;
}

const DEPT_LABEL_AR: Record<string, string> = {
  HR: 'الموارد البشرية',
  FINANCE: 'المالية',
  SALES: 'المبيعات',
  MARKETING: 'التسويق',
  OPERATIONS: 'العمليات',
  IT: 'تقنية المعلومات',
  CUSTOMER_SERVICE: 'خدمة العملاء',
  SUPPORT: 'الإمداد والدعم',
  LOGISTICS: 'اللوجستيات',
  QUALITY: 'الجودة',
  PROJECTS: 'المشاريع',
  GOVERNANCE: 'الحوكمة',
  COMPLIANCE: 'الامتثال',
};

function labelDepts(codes: string[]): string {
  return codes.map((c) => DEPT_LABEL_AR[c] ?? c).join(' و');
}

function runContradictionRules(snapshots: DeptSnapshot[]): ContradictionInsight[] {
  const insights: ContradictionInsight[] = [];
  if (snapshots.length < 2) return insights;

  // ─── القاعدة ١: فجوة نضج الفريق ──────────────────────────────────────
  const teamStrong = snapshots.filter((d) => d.axes.team >= 70);
  const teamWeak = snapshots.filter((d) => d.axes.team <= 40);
  if (teamStrong.length > 0 && teamWeak.length > 0) {
    const strongList = teamStrong.map((d) => d.code);
    const weakList = teamWeak.map((d) => d.code);
    insights.push({
      id: 'team_gap',
      severity: 'HIGH',
      title: 'فجوة نضج الفريق بين الإدارات',
      description: `${labelDepts(strongList)} يقيّم فرق العمل بمستوى عالٍ (${Math.round(Math.max(...teamStrong.map((d) => d.axes.team)))}٪) بينما ${labelDepts(weakList)} في مستوى منخفض (${Math.round(Math.min(...teamWeak.map((d) => d.axes.team)))}٪). التفاوت يُبطئ التعاون العابر للأقسام ويربط الأداء بأشخاص مفتاحيين.`,
      affectedDepts: [...strongList, ...weakList],
      suggestedOKR: {
        objective: 'رفع مستوى نضج فرق الأقسام الأضعف',
        keyResults: [
          'إجراء تقييم كفاءات لكل عضو في الفرق الأضعف خلال ٦ أسابيع',
          'ترحيل أفضل ممارسات الفرق الأقوى عبر ورش أسبوعية',
          'رفع مؤشر نضج الفريق للأقسام الأضعف إلى ٦٠٪+ خلال ربع سنة',
        ],
        timeline: '٩٠ يوماً',
      },
    });
  }

  // ─── القاعدة ٢: فجوة الرقمنة ────────────────────────────────────────
  const digitalGap = maxMinGap(snapshots.map((d) => d.axes.digital));
  if (digitalGap && digitalGap.gap > 40) {
    const strong = snapshots.filter((d) => d.axes.digital >= digitalGap.max - 5);
    const weak = snapshots.filter((d) => d.axes.digital <= digitalGap.min + 5);
    insights.push({
      id: 'digital_gap',
      severity: 'MEDIUM',
      title: 'رقمنة غير متوازنة بين الأقسام',
      description: `${labelDepts(strong.map((d) => d.code))} متقدّمة رقمياً (${Math.round(digitalGap.max)}٪) بينما ${labelDepts(weak.map((d) => d.code))} تعتمد على العمل اليدوي (${Math.round(digitalGap.min)}٪). البيانات لا تتدفّق بين الأقسام والتقارير تصل متأخّرة.`,
      affectedDepts: [...strong.map((d) => d.code), ...weak.map((d) => d.code)],
      suggestedOKR: {
        objective: 'توحيد البنية الرقمية عبر الأقسام',
        keyResults: [
          'رسم خريطة تدفّق البيانات بين الأقسام وتحديد نقاط الانقطاع',
          'أتمتة ٣ مهام يدوية حرجة في الأقسام الأضعف',
          'رفع مؤشر الرقمي لكل الأقسام إلى ٥٠٪+',
        ],
        timeline: '١٨٠ يوماً',
      },
    });
  }

  // ─── القاعدة ٣: فجوة الحوكمة ────────────────────────────────────────
  const govStrong = snapshots.filter((d) => d.axes.governance >= 70);
  const govWeak = snapshots.filter((d) => d.axes.governance <= 30);
  if (govStrong.length > 0 && govWeak.length > 0) {
    const weakCodes = govWeak.map((d) => d.code);
    insights.push({
      id: 'governance_gap',
      severity: 'CRITICAL',
      title: 'فجوة حوكمة — تعرّض تنظيمي',
      description: `${labelDepts(govStrong.map((d) => d.code))} تلتزم بإجراءات حوكمة عالية (${Math.round(Math.max(...govStrong.map((d) => d.axes.governance)))}٪) بينما ${labelDepts(weakCodes)} بلا إجراءات موثّقة (${Math.round(Math.min(...govWeak.map((d) => d.axes.governance)))}٪). القسم الأضعف يشكّل تعرّضاً تنظيمياً ومصدر مخاطرة سمعة.`,
      affectedDepts: [...govStrong.map((d) => d.code), ...weakCodes],
      suggestedOKR: {
        objective: 'رفع نضج الحوكمة للأقسام غير الملتزمة',
        keyResults: [
          `توثيق إجراءات ${labelDepts(weakCodes)} الأساسية خلال ٤ أسابيع`,
          'تعيين مسؤول حوكمة لكل قسم أضعف',
          'اجتياز تدقيق داخلي للأقسام المُعالَجة',
        ],
        timeline: '٦٠ يوماً',
      },
    });
  }

  // ─── القاعدة ٤: تضاد مالي ────────────────────────────────────────────
  const financeDept = snapshots.find((d) => d.code === 'FINANCE');
  const financialStressed = snapshots.filter(
    (d) => d.code !== 'FINANCE' && d.axes.financial <= 40
  );
  if (financeDept && financeDept.axes.financial >= 70 && financialStressed.length >= 2) {
    insights.push({
      id: 'financial_mismatch',
      severity: 'HIGH',
      title: 'تضاد في الأولويات المالية',
      description: `قسم المالية يقيّم الوضع المالي بمستوى صحّي (${Math.round(financeDept.axes.financial)}٪) بينما ${financialStressed.length} أقسام (${labelDepts(financialStressed.map((d) => d.code))}) تشكو من قيود مالية (تقييم ≤٤٠٪). إشارة على أنّ الأولويات المالية لا تصل الأقسام أو الميزانيات غير متوازنة.`,
      affectedDepts: ['FINANCE', ...financialStressed.map((d) => d.code)],
      suggestedOKR: {
        objective: 'مواءمة الأولويات المالية عبر الأقسام',
        keyResults: [
          'إجراء ورشة أولويات مع رؤساء الأقسام الأضعف مالياً',
          'إعادة توزيع ١٥٪ من الميزانية التشغيلية على الأقسام المتضرّرة',
          'إطلاق تقارير مالية شهرية شفافة لكل قسم',
        ],
        timeline: '٤٥ يوماً',
      },
    });
  }

  // ─── القاعدة ٥: اختلال شامل ─────────────────────────────────────────
  const healthGap = maxMinGap(snapshots.map((d) => d.healthPct));
  if (healthGap && healthGap.gap > 40) {
    const best = snapshots.find((d) => d.healthPct === healthGap.max);
    const worst = snapshots.find((d) => d.healthPct === healthGap.min);
    if (best && worst) {
      insights.push({
        id: 'overall_imbalance',
        severity: 'MEDIUM',
        title: 'اختلال شامل في نضج الأقسام',
        description: `${labelDepts([best.code])} في مستوى نضج عالٍ (${Math.round(best.healthPct)}٪) بينما ${labelDepts([worst.code])} في مستوى منخفض (${Math.round(worst.healthPct)}٪). فارق ${Math.round(healthGap.gap)} نقطة يعني أنّ القيمة تُخلق في مكان وتُهدر في مكان آخر.`,
        affectedDepts: [best.code, worst.code],
        suggestedOKR: {
          objective: `تسريع نضج قسم ${DEPT_LABEL_AR[worst.code] ?? worst.code} للاقتراب من المتوسط`,
          keyResults: [
            `مراجعة ممارسات ${DEPT_LABEL_AR[best.code] ?? best.code} وترحيل ٣ منها`,
            `رفع صحة ${DEPT_LABEL_AR[worst.code] ?? worst.code} بمقدار ٢٠ نقطة`,
            'تعيين مالك نتائج (owner) للتحسين',
          ],
          timeline: '١٢٠ يوماً',
        },
      });
    }
  }

  return insights;
}

function maxMinGap(values: number[]): { min: number; max: number; gap: number } | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, gap: max - min };
}

export const getContradictions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = (req.params as Record<string, string>).companyId;
    if (!companyId) throw new HttpError(400, 'معرّف الشركة مطلوب');

    // نتحقّق أنّ المستخدم عضو في هذه الشركة (CompanyUser link).
    const link = await prisma.companyUser.findUnique({
      where: { userId_companyId: { userId: req.auth.sub, companyId } },
    });
    if (!link) throw new HttpError(403, 'لا تملك صلاحية الوصول إلى هذه الشركة');

    // نجلب كل الإدارات مع آخر تدقيق لكل واحدة.
    const departments = await prisma.department.findMany({
      where: { companyId },
      include: { audits: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const snapshots: DeptSnapshot[] = [];
    for (const d of departments) {
      const latest = d.audits[0];
      if (!latest) continue;
      const axes: Record<Axis, number> = { governance: 0, financial: 0, team: 0, digital: 0 };
      let anyAxisFound = false;
      for (const a of AXES) {
        const score = parseAxisScore(latest.scores, a);
        if (score != null) {
          axes[a] = score;
          anyAxisFound = true;
        }
      }
      if (!anyAxisFound) continue;
      snapshots.push({
        code: d.type,
        labelAr: DEPT_LABEL_AR[d.type] ?? d.type,
        healthPct: Math.round(latest.healthPct),
        axes,
      });
    }

    if (snapshots.length < 2) {
      res.json({
        companyId,
        snapshots,
        insights: [],
        message:
          'يحتاج التحليل تدقيقين على الأقل على إدارتين مختلفتين. حالياً بيانات ' +
          snapshots.length +
          ' قسم.',
      });
      return;
    }

    const insights = runContradictionRules(snapshots);

    res.json({ companyId, snapshots, insights, message: null });
  } catch (err) {
    next(err);
  }
};

// نُصدِّر المسميات المساعِدة للاختبار مستقبلاً إن لزم.
export { AXIS_AR };
