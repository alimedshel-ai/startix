import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { NextActionCard } from '@/components/manager/NextActionCard'
import { RescueContextBanner, rescueStepFromTab } from '@/components/manager/RescueContextBanner'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { listInitiatives, listProjects } from '@/lib/strategicApi'
import { GanttChartView } from '@/pages/owner/GanttChartPage'
import { ProjectsView } from '@/pages/owner/ProjectsPage'
import { TasksView } from '@/pages/owner/TasksPage'

// ─── مركز التنفيذ والمتابعة ──────────────────────────────────────────
// يجمع ٣ أدوات المرحلة ⑥ في تبويبات:
//   Projects · Gantt · Tasks
// خطط التنفيذ هي مصدر البيانات لـ Gantt، والمهام أدق تفصيلها.

type TabKey = 'projects' | 'gantt' | 'tasks'

// في وضع الطوارئ نعرض فقط جانت (الخطوة ٤)
const RESCUE_ALLOWED: TabKey[] = ['gantt']

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'projects', icon: '📁', label: 'متابعة المبادرات' },
  { key: 'gantt',    icon: '📅', label: 'مخطّط جانت' },
  { key: 'tasks',    icon: '✓',  label: 'المهام' },
]

export function ExecuteHubPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = (params.get('tab') as TabKey | null) ?? 'projects'
  const isRescueMode = params.get('from') === 'emergency'
  const rescueStep = rescueStepFromTab(activeTab)

  function switchTab(next: TabKey) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  return (
    <StrategicShell
      title="التنفيذ والمتابعة"
      description="مركز موحّد لتحويل المبادرات إلى خطوات تنفيذ، ثم متابعتها زمنيّاً ومهامياً."
    >
      {(companyId) => (
        <div className="flex flex-col gap-6">
          {/* 🚨 وضع الطوارئ: البانر هو الدليل الوحيد — لا ExecuteGuidance مضادّ */}
          {isRescueMode && rescueStep != null ? (
            <RescueContextBanner currentStep={rescueStep} companyId={companyId} />
          ) : (
            <ExecuteGuidance companyId={companyId} activeTab={activeTab} onSwitch={switchTab} />
          )}
          <TabBar
            activeTab={activeTab}
            onSwitch={switchTab}
            filterKeys={isRescueMode ? RESCUE_ALLOWED : null}
          />
          <div>
            {activeTab === 'projects' && <ProjectsView companyId={companyId} />}
            {activeTab === 'gantt'    && <GanttChartView companyId={companyId} />}
            {activeTab === 'tasks'    && <TasksView companyId={companyId} />}
          </div>
        </div>
      )}
    </StrategicShell>
  )
}

// ─── التوجيه الذكيّ داخل مركز التنفيذ ───────────────────────────────
// المنطق:
//   ١) لا مبادرات → ارجع لمركز المبادرات.
//   ٢) لديك مبادرات لكن بلا خطوات تنفيذ → ولّد الخطط من المبادرات (على تبويب projects).
//   ٣) لديك خطوات تنفيذ لكن على تبويب projects → اقترح مخطّط جانت للتحقّق.
//   ٤) الكل جاهز → راجع الأداء في مخطّط جانت / راقب المهام.
function ExecuteGuidance({
  companyId, activeTab, onSwitch,
}: { companyId: string; activeTab: TabKey; onSwitch: (t: TabKey) => void }) {
  const { loading: loadingJourney, completions } = useJourneyCompletions(companyId)
  const [state, setState] = useState<{ loading: boolean; initiatives: number; projects: number }>({
    loading: true, initiatives: 0, projects: 0,
  })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      try {
        const [ins, prjs] = await Promise.all([
          listInitiatives(companyId).catch(() => []),
          listProjects(companyId).catch(() => []),
        ])
        if (!alive) return
        setState({ loading: false, initiatives: ins.length, projects: prjs.length })
      } catch {
        if (alive) setState({ loading: false, initiatives: 0, projects: 0 })
      }
    })()
    return () => { alive = false }
  }, [companyId])

  if (loadingJourney || state.loading) return null

  const clientQS = `?client=${companyId}`

  // ١) لا مبادرات
  if (!completions.initiatives || state.initiatives === 0) {
    return (
      <NextActionCard
        icon="💡"
        title="ارجع لإنشاء المبادرات أوّلاً"
        reason="خطط التنفيذ تُبنى فوق المبادرات — لا تنفيذ بلا خطة استراتيجيّة."
        to={`/priority${clientQS}`}
        cta="افتح المبادرات"
        variant="amber"
      />
    )
  }

  // ٢) مبادرات موجودة لكن لا خطوات تنفيذ
  if (state.projects === 0) {
    if (activeTab !== 'projects') {
      return (
        <NextActionCard
          icon="✨"
          title="ولّد خطط التنفيذ تلقائياً من مبادراتك"
          reason={`لديك ${state.initiatives} مبادرة — المولّد الذكيّ يحوّلها إلى خطط بتواريخ ومسؤوليّات.`}
          to="#"
          cta="افتح المولّد"
          variant="sky"
          onClick={() => onSwitch('projects')}
        />
      )
    }
    return (
      <NextActionCard
        icon="✨"
        title="اضغط «ولّد الآن» لتحويل مبادراتك إلى خطط"
        reason={`لديك ${state.initiatives} مبادرة جاهزة. زر المولّد أعلى القائمة يبني الخطط بمدد ذكيّة.`}
        to="#"
        cta="ابقَ هنا"
        variant="sky"
        onClick={() => { /* البقاء */ }}
      />
    )
  }

  // ٣) خطط موجودة — اقترح جانت للتحقّق
  if (activeTab === 'projects' && state.projects >= 3) {
    return (
      <NextActionCard
        icon="📅"
        title="راجع خططك على مخطّط جانت"
        reason={`لديك ${state.projects} خطوة تنفيذ — الجانت يكشف التداخلات وسير الجدول الزمنيّ.`}
        to="#"
        cta="افتح جانت"
        variant="emerald"
        onClick={() => onSwitch('gantt')}
      />
    )
  }
  if (activeTab === 'gantt') {
    return (
      <NextActionCard
        icon="✓"
        title="راقب مهام كل خطة"
        reason="جانت يعطي الصورة الكبرى؛ تبويب المهام يُظهر التقدّم اليومي وسير التنفيذ."
        to="#"
        cta="افتح المهام"
        variant="indigo"
        onClick={() => onSwitch('tasks')}
      />
    )
  }

  // ٤) على تبويب المهام أو حالة عامّة
  return (
    <NextActionCard
      icon="✅"
      title="أنت في وضع التنفيذ — استمرّ في المتابعة"
      reason={`${state.projects} خطة نشطة. راجع الأداء أسبوعياً وحدّث المهام لضمان السير.`}
      to={`/manager/strategic-plan${clientQS}`}
      cta="افتح الخطة الشاملة"
      variant="emerald"
    />
  )
}

function TabBar({ activeTab, onSwitch, filterKeys }: {
  activeTab: TabKey
  onSwitch: (t: TabKey) => void
  filterKeys?: TabKey[] | null
}) {
  const visible = filterKeys ? TABS.filter((t) => filterKeys.includes(t.key)) : TABS
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-2">
      {visible.map((t) => {
        const active = t.key === activeTab
        return (
          <Button
            key={t.key}
            variant={active ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSwitch(t.key)}
            className="gap-1.5"
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </Button>
        )
      })}
      {filterKeys && (
        <span className="mr-auto self-center rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
          🚨 وضع الطوارئ — جانت فقط
        </span>
      )}
    </div>
  )
}
