import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { StrategicPathCard } from '@/components/manager/StrategicPathCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL, dangerZoneColor, type DangerZone, type DeptCode } from '@/lib/deptApi'
import { isToolVisible, visibleTools } from '@/lib/goalGating'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import { getArtifact, getSWOT, getTaggedTOWS, listAllArtifacts, listProjects } from '@/lib/strategicApi'
import { useGuidedNext } from '@/hooks/useGuidedNext'
import { useAuthStore } from '@/store/authStore'

// ─── PRO-5 — لوحة العميل الواحد (workspace) ──────────────────────────────────
// المسار: /manager/clients/:companyId. يعرض:
//   • رأس بيانات الشركة + التخصّص + شارة الصحّة
//   • بطاقة "آخر تدقيق" (healthPct + zone + متى)
//   • شبكة أدوات مفتوحة على هذا العميل عبر ?client=X:
//       – تدقيق أساسي        (/manager/{dept}/audit)
//       – تحليل عميق         (/manager/dept-deep)
//       – تحليل SMART        (/manager/dept-smart)
//       – نقطة التعادل       (للـ FINANCE فقط)
//       – خطة الإصلاح        (للـ LOGISTICS/COMPLIANCE)
//       – مركز الحوكمة       (للـ GOVERNANCE)
//
// المصدر: /api/pro/overview → find(companyId). لا endpoint جديد.

// ⚠️ يجب أن يبقى مطابقاً لخريطة الـ nav.ts / router للـ dept audits.
const DEPT_AUDIT_ROUTE: Record<DeptCode, string> = {
  HR:                '/manager/hr/audit',
  FINANCE:           '/manager/finance/audit',
  SALES:             '/manager/sales/audit',
  MARKETING:         '/manager/marketing/audit',
  OPERATIONS:        '/manager/operations/audit',
  IT:                '/manager/it/audit',
  CUSTOMER_SERVICE:  '/manager/cs/audit',
  SUPPORT:           '/manager/cs/audit',
  LOGISTICS:         '/manager/logistics/audit',
  QUALITY:           '/manager/quality/audit',
  PROJECTS:          '/manager/projects/audit',
  GOVERNANCE:        '/manager/governance/audit',
  COMPLIANCE:        '/manager/compliance/audit',
}

// أدوات إضافية تخصّصية — تُعرض فقط إذا التخصّص يدعمها.
const DEPT_EXTRA_TOOLS: Partial<Record<DeptCode, { label: string; to: string; icon: string }[]>> = {
  FINANCE:    [{ label: 'حاسبة نقطة التعادل', to: '/manager/finance/break-even', icon: '⚖️' }],
  LOGISTICS:  [{ label: 'خطة إصلاح اللوجستيات', to: '/manager/logistics/reform',   icon: '🔧' }],
  GOVERNANCE: [{ label: 'مركز الحوكمة',        to: '/manager/governance/hub',      icon: '🏛️' }],
  COMPLIANCE: [
    { label: 'تدقيق احترافي', to: '/manager/compliance/audit-pro', icon: '🛡️' },
    { label: 'خطة الإصلاح',   to: '/manager/compliance/reform',    icon: '🔧' },
  ],
}

export function ClientDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const [data, setData] = useState<{ forId: string | null; client: OverviewClient | null; error: string | null }>({ forId: null, client: null, error: null })

  useEffect(() => {
    if (!isPro || !companyId) return
    let alive = true
    // الـeffect لا يستدعي setState متزامناً — فقط setData بعد await (then/catch).
    getProOverview()
      .then((res) => {
        if (!alive) return
        const found = res.clients.find((c) => c.companyId === companyId) ?? null
        setData({ forId: companyId, client: found, error: found ? null : 'لم نجد هذا العميل في قائمتك.' })
      })
      .catch((err: unknown) => {
        if (!alive) return
        setData({ forId: companyId, client: null, error: apiErrorMessage(err, 'تعذّر تحميل بيانات العميل') })
      })
    return () => { alive = false }
  }, [isPro, companyId])

  // مشتقّ أثناء الرندر — loading/error/client بلا setState متزامن في الـeffect.
  const loading = isPro && !!companyId && data.forId !== companyId
  const client = data.forId === companyId ? data.client : null
  const error = data.forId === companyId ? data.error : null

  if (!isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="لوحة العميل" />
        <EmptyState
          title="هذه الشاشة للمدير المستقل"
          description="سجّل كمدير مستقل واختر تخصّصاً لعرض عملائك."
        />
      </div>
    )
  }

  if (loading) return <LoadingSpinner fullPage label="جاري تحميل العميل…" />

  if (error || !client) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="لوحة العميل" />
        <EmptyState
          title={error ?? 'العميل غير موجود'}
          description="عُد إلى قائمة عملائك أو تحقّق من الرابط."
          action={
            <button
              onClick={() => navigate('/manager/clients')}
              className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              العودة لعملائي
            </button>
          }
        />
      </div>
    )
  }

  const { companyName, specialty, sector, size, stage, healthPct, dangerZone, lastAuditAt, daysSinceLastAudit, hasAnyAudit, hasDepartment } = client
  const clientQ = `?client=${client.companyId}`
  const extras = DEPT_EXTRA_TOOLS[specialty] ?? []
  // R3 — بوّابة الأهداف: نستنتج الأدوات المرئية من user.goals. لو المدير
  // لم يُكمل onboarding (goals فارغة) → لا فلترة (كل الأدوات مرئية).
  const gatedSet = visibleTools(user?.goals ?? null)
  const mutedFor = (basePath: string) => !isToolVisible(basePath, gatedSet)

  return (
    <ClientDetailContent
      client={client}
      companyName={companyName}
      specialty={specialty}
      sector={sector}
      size={size}
      stage={stage}
      healthPct={healthPct}
      dangerZone={dangerZone}
      lastAuditAt={lastAuditAt}
      daysSinceLastAudit={daysSinceLastAudit}
      hasAnyAudit={hasAnyAudit}
      hasDepartment={hasDepartment}
      clientQ={clientQ}
      extras={extras}
      mutedFor={mutedFor}
      user={user}
    />
  )
}

// ─── مكوّن العرض الفعليّ — يستضيف hook useJourneyCompletions ─────────
// السبب: hooks لا يمكن استدعاؤها بعد early return (loading/error). الفصل
// إلى مكوّن يجعل React يبدأ tree جديد فيه، فتُطبَّق قواعد الـhooks بحرّية.
function ClientDetailContent(p: {
  client: OverviewClient
  companyName: string
  specialty: DeptCode
  sector: string | null
  size: string
  stage: string | null
  healthPct: number | null
  dangerZone: DangerZone | null
  lastAuditAt: string | null
  daysSinceLastAudit: number | null
  hasAnyAudit: boolean
  hasDepartment: boolean
  clientQ: string
  extras: { label: string; to: string; icon: string }[]
  mutedFor: (basePath: string) => boolean
  user: ReturnType<typeof useAuthStore.getState>['user']
}) {
  const { client, companyName, specialty, sector, size, stage, healthPct, dangerZone, lastAuditAt, daysSinceLastAudit, hasAnyAudit, hasDepartment, clientQ, extras, mutedFor, user } = p

  // مصالحة الآليّ↔اليدويّ — شارة التقادم (توقظ منطق reconcileLevel النائم).
  const { resolution } = useGuidedNext(client.companyId)

  // ⭐ قراءة اكتمال كل أداة على حدة عبر artifact الخاصّ بها
  // (بدل completions المرحلة الواحدة التي تعتبر كل الأدوات مكتملة إذا كمُلت واحدة)
  const [artifactTypes, setArtifactTypes] = useState<Set<string>>(new Set())
  const [hasSwot, setHasSwot] = useState(false)
  // TOWS لا يُحفَظ كـ artifact — بل في حقل SWOT.tows. نفحصه من مصدره الصحيح.
  const [hasTows, setHasTows] = useState(false)
  // مركز التنفيذ يكتمل بوجود مشاريع (خطوات تنفيذ) — لا artifact له.
  const [hasProjects, setHasProjects] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  // اكتمال دقيق للتشخيص المبسّط — عدد الأسئلة الأربعة المُجابة
  const [deptDeepFilledCount, setDeptDeepFilledCount] = useState(0)
  const DEPT_DEEP_TOTAL = 4  // ثابت: ٤ أسئلة

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      listAllArtifacts(client.companyId),
      getSWOT(client.companyId).catch(() => null),
      getArtifact<{ answers?: Record<string, unknown> }>(client.companyId, 'DEPT_DEEP_ANSWERS').catch(() => null),
      getTaggedTOWS(client.companyId).catch(() => null),
      listProjects(client.companyId).catch(() => []),
    ]).then(([arts, swot, deepDeep, tows, projects]) => {
      if (!alive) return
      setHasProjects(projects.status === 'fulfilled' && projects.value.length > 0)
      setArtifactTypes(new Set(arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : []))
      if (swot.status === 'fulfilled' && swot.value) {
        const s = swot.value
        setHasSwot(
          (s.strengths?.length ?? 0) > 0 ||
          (s.weaknesses?.length ?? 0) > 0 ||
          (s.opportunities?.length ?? 0) > 0 ||
          (s.threats?.length ?? 0) > 0,
        )
      }
      // TOWS مكتمل إن وُجد بند واحد في أيّ من الأرباع الأربعة (SO/WO/ST/WT).
      if (tows.status === 'fulfilled' && tows.value) {
        const t = tows.value
        setHasTows(
          (t.so?.length ?? 0) > 0 ||
          (t.wo?.length ?? 0) > 0 ||
          (t.st?.length ?? 0) > 0 ||
          (t.wt?.length ?? 0) > 0,
        )
      }
      // احسب عدد الأسئلة الأربعة المُجابة فعلياً (لا يكفي وجود artifact)
      if (deepDeep.status === 'fulfilled' && deepDeep.value?.data?.answers) {
        const answers = deepDeep.value.data.answers
        let count = 0
        for (const [, v] of Object.entries(answers)) {
          const a = v as { selected?: string[]; other?: string }
          const hasSelected = Array.isArray(a?.selected) && a.selected.length > 0
          const hasOther = typeof a?.other === 'string' && a.other.trim().length > 0
          if (hasSelected || hasOther) count++
        }
        setDeptDeepFilledCount(count)
      }
      setDataLoaded(true)
    })
    return () => { alive = false }
  }, [client.companyId])

  // ─── خريطة الأداة → artifact type(s) للفحص الدقيق ───────────────
  // كل أداة تُفحص عبر artifact محدَّد بدل شارة المرحلة الفضفاضة.
  // dept-scoped: نضع `${type}_${specialty}` أوّلاً، ثم النوع العام كـfallback.
  function isToolDone(path: string): boolean {
    // التدقيق: يجب وجود audit + healthPct حقيقيّ (وليس null فقط)
    if (path === DEPT_AUDIT_ROUTE[specialty]) return hasAnyAudit && healthPct != null
    if (path === '/swot') return hasSwot
    // TOWS يُخزَّن في SWOT.tows لا كـ artifact — يُفحص عبر hasTows لا artifactTypes.
    if (path === '/tows') return hasTows
    // المراكز الموحّدة: اكتمالها = وجود بيانات أيّ من أدواتها (نفس منطق «الخطوة
    // الحاليّة»). كان stateFor يجهلها فتبقى «لم يبدأ» رغم امتلائها.
    if (path === '/measure')  return hasHubData('measure')
    if (path === '/priority') return hasHubData('priority')
    if (path === '/execute')  return hasHubData('execute')
    // التشخيص المبسّط: يجب إجابة كل الأسئلة الـ٤ فعلياً — ليس مجرّد وجود artifact
    if (path === '/manager/dept-deep') return deptDeepFilledCount >= DEPT_DEEP_TOTAL
    // dept-scoped
    if (path === '/manager/dept-pestel') return artifactTypes.has(`PESTEL_${specialty}`) || artifactTypes.has('PESTEL')
    if (path === '/manager/dept-gap')    return artifactTypes.has(`GAP_ANALYSIS_${specialty}`) || artifactTypes.has('GAP_ANALYSIS')
    // بسيط
    const PATH_TO_ARTIFACT: Record<string, string> = {
      '/manager/deep-analysis':  'DEPT_DEEP_FULL',
      '/internal-environment':   'INTERNAL_ENV',
      '/value-chain':            'VALUE_CHAIN',
      '/porter':                 'PORTER',
      '/core-capabilities':      'CORE_CAPABILITIES',
      '/benchmarking':           'BENCHMARK',
      '/org-dna':                'ORG_DNA',
      '/stakeholders':           'STAKEHOLDERS',
      '/directions':             'DIRECTIONS',
      '/choices':                'CHOICES',
      '/bmc':                    'BMC',
      '/ansoff':                 'ANSOFF',
    }
    const type = PATH_TO_ARTIFACT[path]
    if (!type) return false
    // نسخة الإدارة أوّلاً ثم العامّة: المدير المستقل يحفظ `${type}_${specialty}`
    // (مثل INTERNAL_ENV_HR) لا النوع العامّ — فكان الكرت يقول «لم يبدأ» خطأً رغم
    // اكتمال الأداة. الفحص المزدوج يطابق ما يفعله معالج التحليل الشامل.
    return artifactTypes.has(`${type}_${specialty}`) || artifactTypes.has(type)
  }

  // نسبة الاكتمال الجزئيّ لأداة (٠-١) — تستعمل لعرض «٢/٤» بدل «مكتمل»
  function partialCompletion(path: string): { filled: number; total: number } | null {
    if (path === '/manager/dept-deep') return { filled: deptDeepFilledCount, total: DEPT_DEEP_TOTAL }
    return null
  }

  // ─── تسلسل الأداة «الأساسيّة الآن» — صارم، أداة-بأداة ────────────
  // كلّ خطوة تُفحص فرديّاً؛ لا تقفز فوق أدوات ناقصة.
  //   ١. dept-deep (٤ أسئلة سريعة)
  //   ٢. تدقيق التخصّص (١٢-١٥ سؤالاً)
  //   ٣. PESTEL (بيئة خارجيّة)
  //   ٤. 7S — البيئة الداخليّة
  //   ٥. SWOT (توليف)
  //   ٦. TOWS (استراتيجيات)
  //   ٧. Directions (توجّه)
  //   ٨. Measure Hub (أهداف/KPIs)
  //   ٩. Priority Hub (مبادرات)
  //   ١٠. Execute Hub (تنفيذ)
  const currentEssentialPath = ((): string | null => {
    if (!dataLoaded) return null   // انتظر التحميل — لا تعرض ⭐ مؤقّتاً
    if (!isToolDone('/manager/dept-deep'))                     return '/manager/dept-deep'
    if (!hasAnyAudit)                                          return DEPT_AUDIT_ROUTE[specialty]
    if (!isToolDone('/manager/dept-pestel'))                   return '/manager/dept-pestel'
    if (!isToolDone('/internal-environment'))                  return '/internal-environment'
    if (!hasSwot)                                              return '/swot'
    if (!isToolDone('/tows'))                                  return '/tows'
    if (!isToolDone('/directions'))                            return '/directions'
    // بعد التوجّه — الـHubs (نستخدم artifactTypes بشكل تقريبي للـHub)
    if (!hasHubData('measure')) return '/measure'
    if (!hasHubData('priority')) return '/priority'
    if (!hasHubData('execute')) return '/execute'
    return null   // كل التسلسل مكتمل → تظهر بطاقة «التسلسل مكتمل»
  })()

  function hasHubData(hub: 'measure' | 'priority' | 'execute'): boolean {
    if (hub === 'measure')  return artifactTypes.has('OGSM') || artifactTypes.has('ANNUAL_PLAN') || artifactTypes.has('BSC')
    if (hub === 'priority') return artifactTypes.has('PRIORITY_MATRIX') || artifactTypes.has('RISK_REGISTER') || artifactTypes.has('EISENHOWER') || artifactTypes.has('RACI')
    if (hub === 'execute')  return hasProjects
    return false
  }

  // ─── التسلسل الأساسيّ الصارم — لتقفيل الأدوات اللاحقة ─────────────
  const ESSENTIAL_SEQUENCE: string[] = [
    '/manager/dept-deep',
    DEPT_AUDIT_ROUTE[specialty],
    '/manager/dept-pestel',
    '/internal-environment',
    '/swot',
    '/tows',
    '/directions',
    '/measure',
    '/priority',
    '/execute',
  ]

  const stateFor = (path: string): ToolCardState => {
    if (!dataLoaded) return 'idle'
    if (path === currentEssentialPath) return 'current'
    if (isToolDone(path)) return 'done'
    // مقفلة: إن كانت هذه أداة أساسيّة وموقعها بعد الأداة الحاليّة في التسلسل
    const idx = ESSENTIAL_SEQUENCE.indexOf(path)
    const currentIdx = currentEssentialPath ? ESSENTIAL_SEQUENCE.indexOf(currentEssentialPath) : -1
    if (idx >= 0 && currentIdx >= 0 && idx > currentIdx) return 'locked'
    // خارج التسلسل الأساسيّ (أدوات مساندة) → تبقى متاحة
    return 'idle'
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`🏢 ${companyName}`}
        description={`${sector ?? 'قطاع غير محدّد'} · ${sizeLabel(size)}${stage ? ` · ${stage}` : ''} · إدارة ${DEPT_LABEL[specialty]}`}
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: companyName },
        ]}
      />

      {/* شارة مسار المدير الاستراتيجي — يذكّر بالطموح المُختار */}
      {user?.strategyPath && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-card/40 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">مسارك:</span>
          {user.strategyPath === 'QUICK'  && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">⚡ تشغيلي (قصير · ٠–٣ شهر)</span>}
          {user.strategyPath === 'MEDIUM' && <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 font-medium text-sky-800">🎯 تكتيكي (متوسّط · ٣–١٢ شهر)</span>}
          {user.strategyPath === 'LONG'   && <span className="rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 font-medium text-purple-800">🔭 استراتيجي (طويل · ١٢–٣٦+ شهر)</span>}
          <span className="text-muted-foreground">·</span>
          <Link to="/settings/path" className="text-muted-foreground underline-offset-4 hover:underline">تغيير</Link>
        </div>
      )}

      {/* ⚠️ شارة التقادم — بياناتك (الآليّ) فارقت مسارك اليدويّ. توقظ reconcileLevel. */}
      {resolution?.isStale && (
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-xs ${
          resolution.direction === 'upgrade'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
            : 'border-rose-300 bg-rose-50 text-rose-900'
        }`}>
          <span className="flex items-center gap-1.5 font-medium">
            <span>{resolution.direction === 'upgrade' ? '⬆️' : '⚠️'}</span>
            {resolution.why}
          </span>
          <Link to="/settings/path" className="shrink-0 rounded-md border bg-card px-2.5 py-1 font-semibold underline-offset-4 hover:bg-accent">
            {resolution.direction === 'upgrade' ? 'رقِّ مسارك ←' : 'راجِع مسارك ←'}
          </Link>
        </div>
      )}

      <HealthCard
        specialty={specialty}
        healthPct={healthPct}
        dangerZone={dangerZone}
        lastAuditAt={lastAuditAt}
        daysSince={daysSinceLastAudit}
        hasAnyAudit={hasAnyAudit}
        hasDepartment={hasDepartment}
      />

      {/* 🧭 القمرة — الشاشة الموجّهة: مكان واحد لتشغيل المسار خطوةً-خطوة */}
      <Link
        to={`/manager/clients/${client.companyId}/run`}
        className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary bg-gradient-to-l from-primary/15 to-primary/5 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">🧭 <span>افتح القمرة الموجّهة</span></div>
          <p className="mt-0.5 text-xs text-muted-foreground">شاشة واحدة: أنت هنا · الخطوة التالية · التقدّم — بلا تشتّت.</p>
        </div>
        <span className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">تابِع المسار ←</span>
      </Link>

      {/* 🎯 ابدأ من هنا — بطاقة كبيرة موحّدة تُخبر المدير بالخطوة القادمة الفوريّة */}
      <StartHereBeacon
        companyId={client.companyId}
        specialty={specialty}
        clientQ={clientQ}
        hasAnyAudit={hasAnyAudit}
        hasDeptDeep={isToolDone('/manager/dept-deep')}
        auditRoute={DEPT_AUDIT_ROUTE[specialty]}
        healthPct={healthPct}
      />

      {/*
        PlanningJourneyCard (٦ خطوات مرقّمة) حُذف من هذه الصفحة —
        كان يتضارب مع ترقيمي (١٠ خطوات) على البطاقات أدناه. بطاقات
        الأدوات الآن تعرض الرقم + الحالة + الشريط بدقّة أعلى.
        إن أردت مراجعة الرحلة بـ٦ مراحل: /manager/clients/:id/journey.
      */}

      {/* 🔒 بانر التقفيل — يظهر عند وجود خطوة أساسيّة ناقصة */}
      {dataLoaded && currentEssentialPath && (() => {
        const currentIdx = ESSENTIAL_SEQUENCE.indexOf(currentEssentialPath)
        const doneCount = currentIdx // كل الأدوات قبل الحاليّة تُعتبر مكتملة
        const total = ESSENTIAL_SEQUENCE.length
        const pct = Math.round((doneCount / total) * 100)
        return (
          <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-amber-400 bg-gradient-to-l from-amber-100/70 to-transparent p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-2xl">🔒</div>
              <div className="flex-1 text-xs leading-relaxed">
                <div className="font-bold text-amber-900">
                  أنت في الخطوة {doneCount + 1} من {total} — الأدوات اللاحقة مقفلة
                </div>
                <p className="mt-1 text-amber-800/80">
                  التسلسل مصمَّم بحيث كل خطوة تُغذّي التالية بالبيانات. أكمل الخطوة الحاليّة (⭐) لفتح ما بعدها.
                  الأدوات المساندة (Porter/DNA/أصحاب المصلحة/…) تبقى متاحة اختيارياً.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-amber-900">{pct}٪</div>
                <div className="text-[10px] text-amber-800/70">مكتمل</div>
              </div>
            </div>
            {/* شريط تقدّم مرئي */}
            <div className="h-2 overflow-hidden rounded-full bg-amber-200/50">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })()}
      {dataLoaded && !currentEssentialPath && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-emerald-400 bg-gradient-to-l from-emerald-100/70 to-transparent p-4">
          <div className="text-2xl">🏆</div>
          <div className="flex-1 text-xs leading-relaxed">
            <div className="font-bold text-emerald-900">
              التسلسل الأساسيّ مكتمل — راجع النتائج على الخطة الاستراتيجيّة
            </div>
            <p className="mt-1 text-emerald-800/80">
              أنت في وضع «التنفيذ المستمرّ». تابع KPIs والمهام أسبوعياً.
            </p>
          </div>
        </div>
      )}

      {/* ═══ التسلسل الكامل والأدوات — مطويّ افتراضياً ═══════════════
         قرار بنيويّ: أعلى الصفحة يعرض *مكاناً واحداً للبدء* (البطاقة
         الموجّهة + شريط «أنت هنا»). كل بطاقات المراحل والأدوات المرقّمة
         — التي كانت تتنافس بـ«ابدأ» متعدّدة — تنطوي هنا خلف زرّ واحد؛
         متاحة عند الحاجة، بلا تشتيت المدير عن الخطوة الفوريّة. */}
      <details className="group rounded-xl border bg-card/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold transition hover:bg-accent/40">
          <span className="flex items-center gap-2">
            🗺️ عرض التسلسل الكامل والأدوات
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-normal text-muted-foreground">١٠ مراحل مرقّمة + أدوات مساندة</span>
          </span>
          <span className="text-xs text-muted-foreground transition group-open:rotate-180">▼</span>
        </summary>
        <div className="space-y-6 border-t p-4">

      {/* ─── المسار الاستراتيجي الموصى به ─────────────────────────
         بطاقة تحدّد لو الوضع يحتاج خطة عاجلة (٩٠ يوم) أو تأسيسية
         (٦ أشهر) أو نموّ (١٢ شهر) أو تميّز (١٨ شهر). المدير الخبير
         يفتحها → صفحة الخطة الكاملة. */}
      <StrategicPathCard
        companyId={client.companyId}
        companyName={companyName}
        healthPct={healthPct}
        dangerZone={dangerZone}
        hasAnyAudit={hasAnyAudit}
      />

      {/* R2 — Handoff إلى التسلسل الاستراتيجي المقفل. يظهر فقط عندما
         يوجد تدقيق. هذا هو السطر المفقود في المسار القديم: بدل شاشة
         النتائج المغلقة → يفتح المدير التسلسل المقفل (البيئة → SWOT →
         التوجه/الخيارات → المؤشرات → المبادرات → التنفيذ). */}
      {hasAnyAudit && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5 p-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              🧭 <span>ابدأ التسلسل الاستراتيجي المقفل</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ٤ مراحل مقفلة (البيئة → SWOT/TOWS → التوجه → المؤشرات) ثم ٢ مفتوحتان (المبادرات → التنفيذ).
            </p>
          </div>
          <Link
            to={`/manager/clients/${client.companyId}/journey`}
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
          >
            فتح التسلسل ←
          </Link>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">أدوات العمل على هذا العميل</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* ١. التشخيص المبسّط — أوّل خطوة (٤ أسئلة سريعة قبل التدقيق العميق) */}
          <ToolCard
            icon="📝"
            title="التشخيص المبسّط"
            description={
              deptDeepFilledCount > 0 && deptDeepFilledCount < DEPT_DEEP_TOTAL
                ? `أجبت ${deptDeepFilledCount} من ${DEPT_DEEP_TOTAL} أسئلة — أكمل الباقي لتفتح التدقيق.`
                : '٤ أسئلة سريعة (القيود / الهشاشة / الأتمتة / الممارسات) — يعطي صورة عامّة قبل التدقيق.'
            }
            to={`/manager/dept-deep${clientQ}`}
            primary
            state={stateFor('/manager/dept-deep')}
            stepNumber={1}
            totalSteps={10}
            partialProgress={partialCompletion('/manager/dept-deep')}
          />
          {/* ٢. التدقيق العميق — بعد التشخيص */}
          <ToolCard
            icon={DEPT_ICON[specialty]}
            title={`تدقيق ${DEPT_LABEL[specialty]}`}
            description={
              hasAnyAudit && healthPct != null
                ? 'اضغط للمراجعة أو إعادة التدقيق (١٢-١٥ سؤالاً).'
                : '12-15 سؤالاً على ٤ محاور. النتيجة تحفظ آلياً وتُغذّي كل الأدوات اللاحقة.'
            }
            to={`${DEPT_AUDIT_ROUTE[specialty]}${clientQ}`}
            primary
            state={stateFor(DEPT_AUDIT_ROUTE[specialty])}
            stepNumber={2}
            totalSteps={10}
            healthMetric={{ value: hasAnyAudit ? healthPct : null, label: 'صحّة الإدارة' }}
          />
        </div>
      </div>

      {/* المرحلة ① — تحليل البيئة (ترتيب مطابق لجدول ٣٤ الأداة) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          المرحلة ① — تحليل البيئة (تُغذّي SWOT في المرحلة ②)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* #3 — PESTEL ⭐ */}
          <ToolCard
            icon="🌐"
            title={`PESTEL — ${DEPT_LABEL[specialty]}`}
            description="٦ عوامل خارجية بمقترحات مخصّصة لتخصّصك."
            to={`/manager/dept-pestel${clientQ}`}
            primary
            muted={mutedFor('/manager/dept-pestel')}
            state={stateFor('/manager/dept-pestel')}
            stepNumber={3}
            totalSteps={10}
          />
          {/* #4 — البيئة الداخلية 7S ⭐ */}
          <ToolCard
            icon="🎯"
            title="البيئة الداخلية (7S)"
            description="نموذج McKinsey — استراتيجية/هيكل/أنظمة/قيادة/فريق/مهارات/قيم."
            to={`/internal-environment${clientQ}`}
            primary
            muted={mutedFor('/internal-environment')}
            state={stateFor('/internal-environment')}
            stepNumber={4}
            totalSteps={10}
          />
        </div>
      </div>

      {/* التوليف الاستراتيجي — أدوات تحليل إدارة العميل */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">التوليف الاستراتيجي</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            icon="🧭"
            title="تحليل SWOT"
            description="نقاط القوة والضعف والفرص والتهديدات لإدارة العميل — مع بذر تلقائي."
            to={`/swot${clientQ}`}
            muted={mutedFor('/swot')}
            state={stateFor('/swot')}
            stepNumber={5}
            totalSteps={10}
          />
          <ToolCard
            icon="🔄"
            title="مصفوفة TOWS"
            description="تحويل SWOT إلى استراتيجيات فعلية (SO/ST/WO/WT)."
            to={`/tows${clientQ}`}
            muted={mutedFor('/tows')}
            state={stateFor('/tows')}
            stepNumber={6}
            totalSteps={10}
          />
          {/* خريطة المخاطر ومصفوفة الأولوية → مضمّنتان في مركز المبادرات أدناه */}
        </div>
      </div>

      {/* التخطيط والتنفيذ — ٣ مراكز موحَّدة تحلّ محلّ ١٥ أداة فرديّة */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          التخطيط والتنفيذ
          <span className="text-[10px] font-normal text-muted-foreground/70">
            ← الأدوات الفرديّة مُجمَّعة الآن في ٣ مراكز موحَّدة
          </span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ToolCard
            icon="📊"
            title="مركز القياس والأهداف"
            description="٧ أدوات: الأهداف · OKRs · OGSM · KPIs · Balanced Scorecard · الإدخالات · الخطة السنويّة."
            to={`/measure${clientQ}`}
            primary
            muted={mutedFor('/measure')}
            state={stateFor('/measure')}
            stepNumber={8}
            totalSteps={10}
          />
          <ToolCard
            icon="💡"
            title="مركز المبادرات والأولويّات"
            description="٥ أدوات: المبادرات · مصفوفة الأولويّة · أيزنهاور · خريطة المخاطر · RACI."
            to={`/priority${clientQ}`}
            primary
            muted={mutedFor('/priority')}
            state={stateFor('/priority')}
            stepNumber={9}
            totalSteps={10}
          />
          <ToolCard
            icon="🚀"
            title="مركز التنفيذ والمتابعة"
            description="٣ أدوات: متابعة المبادرات · مخطّط جانت · المهام."
            to={`/execute${clientQ}`}
            primary
            muted={mutedFor('/execute')}
            state={stateFor('/execute')}
            stepNumber={10}
            totalSteps={10}
          />
        </div>
      </div>

        </div>
      </details>

      {/* ═══ أدوات متقدّمة (اختياريّة) — مطويّة افتراضياً لإزالة التشتّت ═══
         ليست جزءاً من التسلسل الأساسيّ المرقّم؛ تُعمّق التحليل حين يحتاجه
         عميلٌ بعينه (سوق تنافسي → Porter، ثقافة → DNA، مالية → Dupont…). */}
      <details className="group rounded-xl border-2 border-dashed border-muted-foreground/25 bg-card/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <span className="flex items-center gap-2">
            🧰 أدوات متقدّمة (اختياريّة — للتعميق عند الحاجة)
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-normal">غير مطلوبة للخطة</span>
          </span>
          <span className="text-xs transition group-open:rotate-180">▼</span>
        </summary>
        <div className="border-t border-dashed p-4">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            التسلسل الأساسيّ لا يعتمد على أيّ منها — افتحها فقط حين يحتاج عميلٌ بعينه تعميقاً في زاوية محدّدة.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* تحليل البيئة — أدوات تعميق */}
            <ToolCard
              icon="🔗"
              title={`سلسلة القيمة — ${DEPT_LABEL[specialty]}`}
              description="أنشطة الإدارة الأساسية والمُمكِّنة (٧ أنشطة مخصّصة)."
              to={`/value-chain${clientQ}`}
              muted={mutedFor('/value-chain')}
            />
            <ToolCard
              icon="⚔️"
              title="قوى بورتر الخمس"
              description="الموردون، المشترون، البدلاء، الداخلون الجدد، التنافس."
              to={`/porter${clientQ}`}
              muted={mutedFor('/porter')}
            />
            <ToolCard
              icon="💎"
              title="القدرات الجوهرية"
              description="ما تتفوّق فيه إدارتك — Value/Rareness/Imitability/Org."
              to={`/core-capabilities${clientQ}`}
              muted={mutedFor('/core-capabilities')}
            />
            <ToolCard
              icon="🔍"
              title="المقارنة المرجعية"
              description="Benchmarking مع معايير القطاع والحجم."
              to={`/benchmarking${clientQ}`}
              muted={mutedFor('/benchmarking')}
            />
            <ToolCard
              icon="🧬"
              title="DNA المنظمة"
              description="القيم، الثقافة، الحمض التنظيمي للشركة."
              to={`/org-dna${clientQ}`}
              muted={mutedFor('/org-dna')}
            />
            <ToolCard
              icon="👥"
              title="أصحاب المصلحة"
              description="خريطة نفوذ × اهتمام لكل صاحب مصلحة."
              to={`/stakeholders${clientQ}`}
              muted={mutedFor('/stakeholders')}
            />
            <ToolCard
              icon="🔬"
              title="التحليل العميق للإدارة"
              description="بنك ٣٣٠ سؤالاً على ٦ أقسام — يُغذّي البيئة الداخلية بالتفصيل."
              to={`/manager/deep-analysis${clientQ}`}
              muted={mutedFor('/manager/deep-analysis')}
              state={stateFor('/manager/deep-analysis')}
            />
            <ToolCard
              icon="📐"
              title={`تحليل الفجوة — ${DEPT_LABEL[specialty]}`}
              description="محاور الحالي/المستهدف (0-100) وخطة الردم — منهجية القديم."
              to={`/manager/dept-gap${clientQ}`}
              muted={mutedFor('/manager/dept-gap')}
              state={stateFor('/manager/dept-gap')}
            />
            {/* تحليل التناقضات */}
            <ToolCard
              icon="⚡"
              title="تحليل التناقضات"
              description="يقارن بيانات الأقسام ويكشف التناقضات + يقترح OKR جاهز لكل تناقض."
              to={`/manager/contradictions${clientQ}`}
            />
            {/* التحليل المالي */}
            <ToolCard
              icon="📊"
              title="Dupont و Monte Carlo"
              description="تفكيك ROE + محاكاة توزيعات مالية للسيناريوهات."
              to={`/financial-analysis${clientQ}`}
            />
            <ToolCard
              icon="⚖️"
              title="نقطة التعادل"
              description="حساب نقطة التعادل + هامش الأمان."
              to={`/manager/finance/break-even${clientQ}`}
            />
            <ToolCard
              icon="✨"
              title="تحليل SMART"
              description="توليد مؤشرات أداء وتوصيات تنفيذية بناءً على درجات التدقيق."
              to={`/manager/dept-smart${clientQ}`}
            />
            {extras.map((ex) => (
              <ToolCard
                key={ex.to}
                icon={ex.icon}
                title={ex.label}
                description="أداة مخصّصة لتخصّصك."
                to={`${ex.to}${clientQ}`}
              />
            ))}
          </div>
        </div>
      </details>
    </div>
  )
}

// ─── مكوّنات فرعية ────────────────────────────────────────────────────────

function HealthCard({
  specialty, healthPct, dangerZone, lastAuditAt, daysSince, hasAnyAudit, hasDepartment,
}: {
  specialty: DeptCode
  healthPct: number | null
  dangerZone: DangerZone | null
  lastAuditAt: string | null
  daysSince: number | null
  hasAnyAudit: boolean
  hasDepartment: boolean
}) {
  if (!hasAnyAudit) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">لم يُجرَ تدقيق بعد لإدارة {DEPT_LABEL[specialty]}</CardTitle>
          <CardDescription>
            {hasDepartment
              ? 'ابدأ التدقيق من الأداة أدناه لتظهر مؤشرات الصحة هنا.'
              : 'الإدارة لم تُنشأ بعد لهذا العميل — إنشاؤها يتم تلقائياً عند بدء أوّل تدقيق.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  const zoneClass = dangerZone ? dangerZoneColor(dangerZone) : 'text-muted-foreground bg-muted border-border'
  const date = lastAuditAt ? new Date(lastAuditAt).toLocaleDateString('ar-SA') : null
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              صحّة إدارة {DEPT_LABEL[specialty]}
              {dangerZone && (
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${zoneClass}`}>
                  {zoneLabel(dangerZone)}
                </span>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {date ? `آخر تدقيق: ${date}` : ''}
              {daysSince != null ? ` · قبل ${daysSince} يوم` : ''}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold tabular-nums text-primary">
              {healthPct}<span className="text-lg">٪</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">الصحة الإجمالية</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${
              (healthPct ?? 0) >= 70 ? 'bg-emerald-500'
              : (healthPct ?? 0) >= 50 ? 'bg-amber-500'
              : 'bg-rose-500'
            }`}
            style={{ width: `${healthPct ?? 0}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── ToolCard مع حالات ديناميكيّة ─────────────────────────────────
// state='current' → حلقة ملوّنة + شارة «⭐ ابدأ الآن» + ترقية بصريّة
// state='done'    → منخفض التباين + ✓ + ترتيب لاحق
// state='locked'  → مقفلة (رمادي + 🔒 + لا يمكن الضغط)
// state='idle'    → التصميم الافتراضي
type ToolCardState = 'current' | 'done' | 'idle' | 'locked'

function ToolCard({
  icon, title, description, to, primary, muted, state = 'idle', lockReason, stepNumber, totalSteps, partialProgress, healthMetric,
}: {
  icon: string; title: string; description: string; to: string
  primary?: boolean; muted?: boolean; state?: ToolCardState; lockReason?: string
  /** رقم هذه الأداة في تسلسل الخطوات الأساسيّة (١، ٢، …) — يعرض شارة «الخطوة N من M». */
  stepNumber?: number
  totalSteps?: number
  /** تقدّم جزئيّ داخل الأداة (مثال ٢/٤ أسئلة مُجابة) — يُظهر شريطاً وشارة. */
  partialProgress?: { filled: number; total: number } | null
  /** مؤشّر صحّة رقميّ للتدقيق (٠-١٠٠٪) — يُعرض دائماً كشريط ملوّن. */
  healthMetric?: { value: number | null; label: string } | null
}) {
  const stateClasses =
    state === 'current' ? 'border-2 border-primary shadow-md ring-2 ring-primary/40 bg-primary/10'
    : state === 'done'  ? 'border-emerald-300 bg-emerald-50/40 opacity-90'
    : state === 'locked' ? 'border-slate-200 bg-slate-100/60 opacity-60 grayscale cursor-not-allowed'
    : primary           ? 'border-primary/40 bg-primary/5'
    :                     'bg-card'

  // تحديد شارة الحالة اليمنى العلويّة
  const statusChip = state === 'current' ? (
    <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
      ⭐ ابدأ الآن
    </span>
  ) : state === 'done' ? (
    <span className="absolute -top-2 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
      ✓ مكتمل ١٠٠٪
    </span>
  ) : state === 'locked' ? (
    <span className="absolute -top-2 right-3 rounded-full bg-slate-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
      🔒 مقفلة
    </span>
  ) : null

  const content = (
    <>
      {statusChip}
      {/* شارة رقم الخطوة (يسار علوي) — تظهر فقط للأدوات الأساسيّة المرقّمة */}
      {stepNumber != null && totalSteps != null && (
        <span className={`absolute -top-2 left-3 rounded-full border-2 px-2 py-0.5 text-[10px] font-bold shadow-sm ${
          state === 'done'    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
          : state === 'current' ? 'border-primary bg-white text-primary'
          : state === 'locked' ? 'border-slate-300 bg-slate-50 text-slate-500'
          : 'border-amber-400 bg-amber-50 text-amber-900'
        }`}>
          الخطوة {stepNumber} من {totalSteps}
        </span>
      )}
      <div className="mb-2 mt-1 text-2xl" aria-hidden>{icon}</div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      {/* شريط صحّة (للتدقيق) — يعرض دائماً حين وُجد healthMetric */}
      {healthMetric && (() => {
        const v = healthMetric.value
        const pct = v ?? 0
        const isNone = v == null
        const colors = isNone
          ? { text: 'text-slate-500', bg: 'bg-slate-100', bar: 'bg-slate-300' }
          : pct >= 70 ? { text: 'text-emerald-800', bg: 'bg-emerald-100', bar: 'bg-emerald-500' }
          : pct >= 40 ? { text: 'text-amber-800',   bg: 'bg-amber-100',   bar: 'bg-amber-500' }
          :             { text: 'text-rose-800',    bg: 'bg-rose-100',    bar: 'bg-rose-500' }
        return (
          <div className="mt-2">
            <div className={`mb-1 flex items-center justify-between text-[10px] ${colors.text}`}>
              <span className="font-bold">{healthMetric.label}</span>
              <span className="tabular-nums">{isNone ? 'لم يبدأ' : `${pct}٪`}</span>
            </div>
            <div className={`h-1.5 overflow-hidden rounded-full ${colors.bg}`}>
              <div className={`h-full transition-all ${colors.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })()}
      {/* شريط تقدّم دائم — يظهر عند وجود partialProgress حتى لو كان صفر أو مئة */}
      {partialProgress && (() => {
        const { filled, total } = partialProgress
        const pct = total > 0 ? Math.round((filled / total) * 100) : 0
        const isComplete = filled >= total
        const isEmpty = filled === 0
        // ألوان بحسب الاكتمال
        const colors = isComplete
          ? { text: 'text-emerald-800', bg: 'bg-emerald-100', bar: 'bg-emerald-500', label: 'منجَز' }
          : isEmpty
            ? { text: 'text-slate-500', bg: 'bg-slate-100', bar: 'bg-slate-300', label: 'لم يبدأ' }
            : { text: 'text-amber-800', bg: 'bg-amber-100', bar: 'bg-amber-500', label: 'قيد التنفيذ' }
        return (
          <div className="mt-2">
            <div className={`mb-1 flex items-center justify-between text-[10px] ${colors.text}`}>
              <span className="font-bold">{colors.label}: {filled}/{total} أسئلة</span>
              <span className="tabular-nums">{pct}٪</span>
            </div>
            <div className={`h-1.5 overflow-hidden rounded-full ${colors.bg}`}>
              <div
                className={`h-full transition-all ${colors.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })()}
      {/* مؤشّر الحالة تحت البطاقة */}
      <div className={`mt-3 text-xs transition ${
        state === 'current' ? 'opacity-100 font-bold text-primary'
        : state === 'done' ? 'opacity-100 text-emerald-700 font-medium'
        : state === 'locked' ? 'opacity-100 text-slate-500 italic'
        : stepNumber != null ? 'opacity-100 text-amber-800 font-medium'
        : 'opacity-0 group-hover:opacity-100 text-primary'
      }`}>
        {state === 'current' ? (
          partialProgress && partialProgress.filled > 0
            ? '⚡ أكمل الباقي ←'
            : '⚡ لم يبدأ — ابدأ الآن ←'
        )
        : state === 'done' ? '✓ منجَز بالكامل'
        : state === 'locked' ? '🔒 أكمل الخطوة الحاليّة أوّلاً'
        : stepNumber != null ? '○ لم يبدأ بعد'
        : 'فتح ←'}
      </div>
    </>
  )

  // مقفلة → div بلا Link
  if (state === 'locked') {
    return (
      <div
        className={`group relative rounded-xl border p-4 transition ${stateClasses}`}
        title={lockReason || 'أكمل الخطوة الحاليّة قبل هذه الأداة.'}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className={`group relative rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${stateClasses} ${muted ? 'opacity-50 grayscale' : ''}`}
      title={muted ? 'خارج أهدافك — لم تُختَر في التسجيل، لكن الوصول متاح.' : undefined}
    >
      {content}
    </Link>
  )
}

// ─── 🎯 «ابدأ من هنا» — بطاقة قائد كبيرة تُخبر المدير بخطوته الفوريّة ─
function StartHereBeacon({
  companyId, specialty, clientQ, hasAnyAudit, hasDeptDeep, auditRoute, healthPct,
}: {
  companyId: string
  specialty: DeptCode
  clientQ: string
  hasAnyAudit: boolean
  hasDeptDeep: boolean
  auditRoute: string
  healthPct: number | null
}) {
  // ١) لا تشخيص ولا تدقيق → ابدأ بالتشخيص المبسّط (أسرع مدخل، ٤ أسئلة).
  if (!hasDeptDeep && !hasAnyAudit) {
    return (
      <Card className="border-2 border-primary bg-gradient-to-l from-primary/15 via-primary/5 to-transparent">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="text-5xl leading-none">📝</div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary">ابدأ من هنا</div>
              <div className="mt-1 text-lg font-bold">ابدأ بالتشخيص المبسّط (٤ أسئلة سريعة)</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                القيود / الهشاشة / الأتمتة / الممارسات — يعطيك صورة عامّة عن إدارة {DEPT_LABEL[specialty]} في ٥ دقائق.
                <b className="text-foreground"> بعده مباشرةً يفتح لك التدقيق العميق (١٢-١٥ سؤالاً).</b>
              </p>
            </div>
          </div>
          <Link
            to={`/manager/dept-deep${clientQ}`}
            className="shrink-0 rounded-lg bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-md hover:opacity-90"
          >
            📝 ابدأ التشخيص ←
          </Link>
        </CardContent>
      </Card>
    )
  }
  // ٢) تشخيص جاهز لكن لا تدقيق → التدقيق العميق التالي.
  if (!hasAnyAudit) {
    return (
      <Card className="border-2 border-primary bg-gradient-to-l from-primary/15 via-primary/5 to-transparent">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="text-5xl leading-none">🎯</div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary">الخطوة التالية</div>
              <div className="mt-1 text-lg font-bold">أجرِ التدقيق العميق لإدارة {DEPT_LABEL[specialty]}</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                ١٢-١٥ سؤالاً على ٤ محاور — يستغرق ١٠-١٥ دقيقة. التشخيص تمّ ✓ الآن التدقيق يفتح رحلة التحليل الكاملة.
              </p>
            </div>
          </div>
          <Link
            to={`${auditRoute}${clientQ}`}
            className="shrink-0 rounded-lg bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-md hover:opacity-90"
          >
            📋 ابدأ التدقيق ←
          </Link>
        </CardContent>
      </Card>
    )
  }
  // تدقيق موجود → خطوة تالية بحسب صحّة الإدارة.
  const isRed = healthPct != null && healthPct < 40
  const nextLabel = isRed ? '⚠️ افتح خطّة الإنقاذ' : '🧭 استمرّ في الرحلة'
  const nextDesc = isRed
    ? `صحّة إدارتك ${healthPct}٪ — تحتاج خطّة عاجلة ٩٠ يوماً قبل أيّ تخطيط طويل.`
    : 'انتقل إلى التسلسل الاستراتيجي — البيئة → SWOT → التوجّه → المؤشرات → المبادرات → التنفيذ.'
  const nextTo = isRed ? `/manager/strategic-plan${clientQ}` : `/manager/clients/${companyId}/journey`
  return (
    <Card className={`border-2 ${isRed ? 'border-rose-400 bg-gradient-to-l from-rose-500/15 to-transparent' : 'border-emerald-400 bg-gradient-to-l from-emerald-500/15 to-transparent'}`}>
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="text-5xl leading-none">{isRed ? '🚨' : '🎯'}</div>
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider ${isRed ? 'text-rose-700' : 'text-emerald-700'}`}>
              الخطوة التالية لك
            </div>
            <div className="mt-1 text-lg font-bold">{nextLabel}</div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{nextDesc}</p>
          </div>
        </div>
        <Link
          to={nextTo}
          className={`shrink-0 rounded-lg px-6 py-3 text-base font-bold text-white shadow-md hover:opacity-90 ${
            isRed ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          افتح ←
        </Link>
      </CardContent>
    </Card>
  )
}

function sizeLabel(size: string): string {
  switch (size) {
    case 'MICRO':  return 'متناهية الصغر'
    case 'SMALL':  return 'صغيرة'
    case 'MEDIUM': return 'متوسطة'
    case 'LARGE':  return 'كبيرة'
    default:       return size
  }
}

function zoneLabel(zone: DangerZone): string {
  switch (zone) {
    case 'GREEN':  return 'أخضر'
    case 'YELLOW': return 'أصفر'
    case 'ORANGE': return 'برتقالي'
    case 'RED':    return 'أحمر'
  }
}
