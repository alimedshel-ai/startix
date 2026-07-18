import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { NextActionCard, type NextActionVariant } from '@/components/manager/NextActionCard'
import { OutsideRescueBanner } from '@/components/manager/OutsideRescueBanner'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { listAllArtifacts, listKPIs, listObjectives } from '@/lib/strategicApi'
import { AnnualPlanView } from '@/pages/owner/AnnualPlanPage'
import { BSCView } from '@/pages/owner/BSCPage'
import { KPIEntriesView } from '@/pages/owner/KPIEntriesPage'
import { KPIsView } from '@/pages/owner/KPIsPage'
import { ObjectivesView } from '@/pages/owner/ObjectivesPage'
import { OGSMView } from '@/pages/owner/OGSMPage'
import { OKRsView } from '@/pages/owner/OKRsPage'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

// ─── مركز القياس والمؤشّرات ─────────────────────────────────────────
// يجمع ٧ أدوات المرحلة ④ في تبويبات داخل صفحة واحدة:
//   Objectives · OKRs · OGSM · KPIs · BSC · KPI Entries · Annual Plan
// كل تبويب يستخدم View مستخرَجاً من صفحته الأصليّة (بلا StrategicShell).
// الروابط القديمة (/kpis, /objectives, ...) تعيد التوجيه هنا مع ?tab=X.

type TabKey = 'objectives' | 'okrs' | 'ogsm' | 'kpis' | 'bsc' | 'entries' | 'annual'

// كل تبويب له «سبب» واضح (why) يُعرض كتلميح ولمّحة أسفل الشريط — لا خيار
// بلا سبب. OKRs/OGSM مُعلَّمتان صراحةً كصياغتين بديلتين لا خطوتين جديدتين.
const TABS: { key: TabKey; icon: string; label: string; why: string; alt?: boolean }[] = [
  { key: 'objectives', icon: '🎯', label: 'الأهداف',            why: 'الوجهة: ما الذي نريد تحقيقه استراتيجياً (الأساس لكل ما بعده).' },
  { key: 'kpis',       icon: '📊', label: 'المؤشّرات (KPIs)',   why: 'الرقم: يُترجم كل هدف إلى مؤشّر قابل للقياس والمتابعة.' },
  { key: 'bsc',        icon: '⚖️', label: 'البطاقة المتوازنة',  why: 'توزّع الأهداف على ٤ منظورات (مالي/عميل/عمليات/تعلّم).' },
  { key: 'entries',    icon: '✍️', label: 'إدخالات المؤشّرات',  why: 'مساندة: تسجّل قيم الـKPIs دوريّاً لتتبّع الأداء الفعليّ.' },
  { key: 'annual',     icon: '🗓️', label: 'الخطة السنويّة',     why: 'توزّع الأهداف والمؤشّرات على جدول زمنيّ سنويّ.' },
  { key: 'okrs',       icon: '🏆', label: 'OKRs',               why: 'صياغة بديلة للأهداف كنتائج رئيسية — اختياريّة، لمن يفضّلها.', alt: true },
  { key: 'ogsm',       icon: '🧩', label: 'OGSM',               why: 'صياغة بديلة للاستراتيجية في صفحة واحدة — اختياريّة.', alt: true },
]

// دمج ذكاء المسار: التبويب الافتراضي يعكس أولويّات كل مسار
function defaultTabFor(path: StrategyPath | null | undefined): TabKey {
  if (path === 'QUICK')  return 'kpis'       // متابعة سريعة
  if (path === 'MEDIUM') return 'objectives' // الأهداف أوّلاً
  return 'bsc'                                // LONG → البطاقة المتوازنة الكاملة
}

export function MeasureHubPage() {
  const [params, setParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const activeTab = (params.get('tab') as TabKey | null) ?? defaultTabFor(user?.strategyPath)
  const isRescueMode = params.get('from') === 'emergency'

  function switchTab(next: TabKey) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  return (
    <StrategicShell
      title="القياس والأهداف"
      description="مركز موحّد لترجمة الاستراتيجية إلى أهداف ومؤشّرات — ٧ أدوات في تبويبات."
    >
      {(companyId) => (
        <div className="flex flex-col gap-6">
          {/* 🚨 تحذير: خارج مسار الإنقاذ الرباعيّ */}
          {isRescueMode && (
            <OutsideRescueBanner
              companyId={companyId}
              toolName="مركز القياس"
              whyOutside="الأهداف السنويّة وBSC وOKRs وKPIs تنتظر خروجك من المنطقة الحمراء والانتقال إلى خطّة تأسيسيّة (٦ أشهر)."
            />
          )}
          {!isRescueMode && <MeasureGuidance companyId={companyId} activeTab={activeTab} onSwitch={switchTab} />}
          <TabBar activeTab={activeTab} onSwitch={switchTab} companyId={companyId} />
          <div>
            {activeTab === 'objectives' && <ObjectivesView companyId={companyId} />}
            {activeTab === 'okrs'       && <OKRsView companyId={companyId} />}
            {activeTab === 'ogsm'       && <OGSMView companyId={companyId} />}
            {activeTab === 'kpis'       && <KPIsView companyId={companyId} />}
            {activeTab === 'bsc'        && <BSCView companyId={companyId} />}
            {activeTab === 'entries'    && <KPIEntriesView companyId={companyId} />}
            {activeTab === 'annual'     && <AnnualPlanView companyId={companyId} />}
          </div>
        </div>
      )}
    </StrategicShell>
  )
}

// ─── التوجيه الذكيّ داخل الـHub ────────────────────────────────────
// المنطق:
//   ١) لم يكتمل ①② (البيئة/التوليف) → رجع للأساس أوّلاً.
//   ٢) اكتمل الأساس، ٤ غير مكتمل → ابنِ الأهداف/المؤشّرات (تبويب الهدف).
//   ٣) اكتمل ٤ → انتقل للـ⑤ المبادرات — «هذا الفصل انتهى».
function MeasureGuidance({
  companyId, activeTab, onSwitch,
}: { companyId: string; activeTab: TabKey; onSwitch: (t: TabKey) => void }) {
  const { loading, completions } = useJourneyCompletions(companyId)
  // completions.indicators يصبح true بمجرّد وجود هدف واحد — فلا نعتمد عليه
  // وحده للانتقال ⑤. نتحقّق من وجود KPIs فعليّة حتى لا نقفز فوق القياس (وحتى
  // لا نتناقض مع بطاقة الأهداف التي تدفع لـKPIs). سلطة «خطوة تالية» واحدة.
  const [hasKpis, setHasKpis] = useState(false)
  const [kpisLoaded, setKpisLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    listKPIs(companyId)
      .then((k) => { if (alive) { setHasKpis(k.length > 0); setKpisLoaded(true) } })
      .catch(() => { if (alive) setKpisLoaded(true) })
    return () => { alive = false }
  }, [companyId])
  if (loading || !kpisLoaded) return null

  const clientQS = `?client=${companyId}`

  // ١) الأساس ناقص
  if (!completions.environment) {
    return (
      <NextActionCard
        icon="🌐"
        title="ارجع للتشخيص قبل بناء الأهداف"
        reason="بلا فهم البيئة الداخليّة/الخارجيّة، الأهداف تصبح تخميناً. أكمل المرحلة ① أوّلاً."
        to={`/manager/diagnostic${clientQS}`}
        cta="ابدأ التشخيص"
        variant="amber"
      />
    )
  }
  if (!completions.synthesis) {
    return (
      <NextActionCard
        icon="🧭"
        title="أكمل التوليف (SWOT) قبل الأهداف"
        reason="التوليف يحوّل التشخيص إلى نقاط قوّة/ضعف — أساس اختيار الأهداف."
        to={`/swot${clientQS}`}
        cta="افتح SWOT"
        variant="amber"
      />
    )
  }

  // ٢) الأساس مكتمل، ④ غير مكتمل
  if (!completions.indicators) {
    // اقترح تبويباً إن كان المستخدم على تبويب لا يخدم الأساس
    if (activeTab === 'entries' || activeTab === 'annual') {
      return (
        <NextActionCard
          icon="🎯"
          title="ابدأ بالأهداف الاستراتيجيّة أوّلاً"
          reason="الإدخالات والخطّة السنويّة تعتمد على أهداف ومؤشّرات محدَّدة سلفاً."
          to="#"
          cta="افتح الأهداف"
          variant="sky"
          onClick={() => onSwitch('objectives')}
        />
      )
    }
    return (
      <NextActionCard
        icon="📊"
        title={`أنشئ ${activeTab === 'objectives' ? 'أهدافك الأولى' : 'مؤشّراتك الأولى'} هنا`}
        reason="المرحلة ④ ليست مكتملة. سجّل ٣-٥ عناصر لتفتح خطوة المبادرات."
        to="#"
        cta="ابقَ هنا"
        variant="sky"
        onClick={() => { /* البقاء في التبويب الحالي */ }}
      />
    )
  }

  // ٢-ب) أهداف موجودة لكن بلا KPIs → الخطوة التالية هي القياس، لا المبادرات.
  // (يوافق بطاقة الأهداف: كلاهما يوجّه لـKPIs بدل التناقض هدف↔مبادرات.)
  if (!hasKpis) {
    return (
      <NextActionCard
        icon="📊"
        title="حوّل أهدافك إلى مؤشّرات (KPIs)"
        reason="لديك أهداف — أكمل المرحلة ④ بمؤشّرات قابلة للقياس قبل الانتقال للمبادرات."
        to="#"
        cta="افتح KPIs"
        variant="sky"
        onClick={() => onSwitch('kpis')}
      />
    )
  }

  // ٣) الأساس + ④ (أهداف + KPIs) مكتملان → انتقل للمبادرات
  const variant: NextActionVariant = 'emerald'
  return (
    <NextActionCard
      icon="✅"
      title="أهدافك ومؤشّراتك جاهزة — انتقل للمبادرات"
      reason="أنت في المرحلة ⑤ — حوّل أهدافك إلى مبادرات تنفيذيّة مرتَّبة."
      to={`/priority${clientQS}`}
      cta="افتح المبادرات"
      variant={variant}
    />
  )
}

function TabBar({ activeTab, onSwitch, companyId }: { activeTab: TabKey; onSwitch: (t: TabKey) => void; companyId: string }) {
  // مسار المراحل: علامة ✓ على المكتمل، ولا علامة على الناقص.
  const [done, setDone] = useState<Partial<Record<TabKey, boolean>>>({})
  useEffect(() => {
    let alive = true
    Promise.allSettled([
      listObjectives(companyId),
      listKPIs(companyId),
      listAllArtifacts(companyId),
    ]).then(([o, k, a]) => {
      if (!alive) return
      const objectives = o.status === 'fulfilled' ? o.value : []
      const arts = new Set(a.status === 'fulfilled' ? a.value.map((x) => x.type) : [])
      setDone({
        objectives: objectives.length > 0,
        kpis: k.status === 'fulfilled' && k.value.length > 0,
        bsc: arts.has('BSC'),
        annual: arts.has('ANNUAL_PLAN'),
        ogsm: arts.has('OGSM'),
        okrs: objectives.some((ob) => (ob.okrs?.length ?? 0) > 0),
      })
    })
    return () => { alive = false }
  }, [companyId])

  const activeWhy = TABS.find((t) => t.key === activeTab)?.why

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-2">
        {TABS.map((t) => {
          const active = t.key === activeTab
          const isDone = done[t.key]
          return (
            <Button
              key={t.key}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onSwitch(t.key)}
              className="gap-1.5"
              title={t.why}
            >
              {isDone && <span className="text-emerald-500" aria-label="مكتمل">✓</span>}
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.alt && <span className="mr-1 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600">بديلة</span>}
            </Button>
          )
        })}
      </div>
      {/* سبب التبويب الحاليّ — لماذا هذه الخطوة */}
      {activeWhy && (
        <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">لماذا هذه الخطوة؟</span> {activeWhy}
        </p>
      )}
    </div>
  )
}
