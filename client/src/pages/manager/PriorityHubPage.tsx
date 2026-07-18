import { useSearchParams } from 'react-router-dom'

import { NextActionCard } from '@/components/manager/NextActionCard'
import { RescueContextBanner, rescueStepFromTab } from '@/components/manager/RescueContextBanner'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { EisenhowerView } from '@/pages/owner/EisenhowerPage'
import { InitiativesView } from '@/pages/owner/InitiativesPage'
import { PriorityMatrixView } from '@/pages/owner/PriorityMatrixPage'
import { RACIView } from '@/pages/owner/RACIPage'
import { RiskMapView } from '@/pages/owner/RiskMapPage'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

// ─── مركز المبادرات والأولويّات ────────────────────────────────────
// يجمع ٥ أدوات المرحلة ⑤ في تبويبات:
//   Initiatives · Priority Matrix · Eisenhower · Risk Map · RACI
// التبويب الافتراضي = المبادرات دائماً؛ بعض التبويبات تُعتَّم لمسارات لا
// تحتاجها (RACI للـQUICK مثلاً) لكن لا يتغيّر الافتراضي بحسب المسار.

type TabKey = 'initiatives' | 'matrix' | 'eisenhower' | 'risk' | 'raci'

// في وضع الطوارئ نُخفي التبويبات غير الأربعة (نبقي: risk, eisenhower, raci)
const RESCUE_ALLOWED: TabKey[] = ['risk', 'eisenhower', 'raci']

const TABS: { key: TabKey; icon: string; label: string; outOfPath?: StrategyPath[]; outOfPathReason?: string }[] = [
  { key: 'initiatives', icon: '💡', label: 'المبادرات الاستراتيجية' },
  { key: 'matrix',      icon: '⚡', label: 'مصفوفة الأولوية' },
  { key: 'eisenhower',  icon: '📊', label: 'مصفوفة أيزنهاور' },
  { key: 'risk',        icon: '⚠️', label: 'خريطة المخاطر' },
  { key: 'raci',        icon: '👥', label: 'مصفوفة RACI', outOfPath: ['QUICK'], outOfPathReason: 'بنية أدوار كاملة لا تناسب المسار التشغيلي (قصير الأمد)' },
]

// المبادرة هي وحدة العمل المؤسِّسة (منها تُشتقّ الأولويّة والأدوار والمخاطر)،
// فيبدأ المركز منها دائماً بدل إسقاط المستخدم على أداة مشتقّة تسبق مصدرها.
const DEFAULT_TAB: TabKey = 'initiatives'

export function PriorityHubPage() {
  const [params, setParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const activeTab = (params.get('tab') as TabKey | null) ?? DEFAULT_TAB
  const isRescueMode = params.get('from') === 'emergency'
  const rescueStep = rescueStepFromTab(activeTab)

  function switchTab(next: TabKey) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  return (
    <StrategicShell
      title="المبادرات والأولويّات"
      description="مركز موحّد لتحديد ما يجب فعله وترتيبه — ٥ أدوات في تبويبات."
    >
      {(companyId) => (
        <div className="flex flex-col gap-6">
          {/* 🚨 وضع الطوارئ: البانر هو الدليل الوحيد — لا PriorityGuidance مضادّ */}
          {isRescueMode && rescueStep != null ? (
            <RescueContextBanner currentStep={rescueStep} companyId={companyId} />
          ) : (
            <PriorityGuidance companyId={companyId} activeTab={activeTab} onSwitch={switchTab} strategyPath={user?.strategyPath ?? null} />
          )}
          <TabBar
            activeTab={activeTab}
            onSwitch={switchTab}
            strategyPath={isRescueMode ? null : (user?.strategyPath ?? null)}
            filterKeys={isRescueMode ? RESCUE_ALLOWED : null}
          />
          <div>
            {activeTab === 'initiatives' && <InitiativesView companyId={companyId} />}
            {activeTab === 'matrix'      && <PriorityMatrixView companyId={companyId} />}
            {activeTab === 'eisenhower'  && <EisenhowerView companyId={companyId} />}
            {activeTab === 'risk'        && <RiskMapView companyId={companyId} />}
            {activeTab === 'raci'        && <RACIView companyId={companyId} />}
          </div>
        </div>
      )}
    </StrategicShell>
  )
}

// ─── التوجيه الذكيّ داخل مركز المبادرات ─────────────────────────────
// المنطق:
//   ١) لا مبادرات (⑤ ناقص) → أنشئ المبادرات أوّلاً (أساس كل ما يليها).
//   ٢) لديك مبادرات لكن على تبويب ثانوي → اقترح البدء بالمصفوفة.
//   ٣) اكتمل ⑤ → انتقل إلى ⑥ التنفيذ.
function PriorityGuidance({
  companyId, activeTab, onSwitch, strategyPath,
}: {
  companyId: string; activeTab: TabKey; onSwitch: (t: TabKey) => void; strategyPath: StrategyPath | null
}) {
  const { loading, completions } = useJourneyCompletions(companyId)
  if (loading) return null

  const clientQS = `?client=${companyId}`

  // ١) لا مبادرات بعد
  if (!completions.initiatives) {
    if (activeTab !== 'initiatives') {
      return (
        <NextActionCard
          icon="💡"
          title="ابدأ بإنشاء ٣-٥ مبادرات أوّلاً"
          reason="المصفوفات والمخاطر والأدوار تعمل فوق المبادرات — لا يمكن ترتيب فراغ."
          to="#"
          cta="افتح المبادرات"
          variant="sky"
          onClick={() => onSwitch('initiatives')}
        />
      )
    }
    return (
      <NextActionCard
        icon="💡"
        title="سجّل مبادراتك الاستراتيجيّة هنا"
        reason="اقترح ٣-٥ مبادرات لكل هدف. بعدها ترتّبها في المصفوفات وتعيّن مسؤوليها."
        to="#"
        cta="ابقَ هنا"
        variant="sky"
        onClick={() => { /* البقاء */ }}
      />
    )
  }

  // ٢) لديك مبادرات — اقترح المصفوفة إن كان المسار QUICK ولم يكن عليها
  if (strategyPath === 'QUICK' && activeTab !== 'eisenhower') {
    return (
      <NextActionCard
        icon="⚡"
        title="مسارك تشغيلي — استخدم مصفوفة أيزنهاور"
        reason="مسارك القصير يحتاج فرزاً فورياً «مهم/عاجل» بدل بنية RACI الكاملة."
        to="#"
        cta="افتح أيزنهاور"
        variant="orange"
        onClick={() => onSwitch('eisenhower')}
      />
    )
  }

  // ٣) الكل جاهز — انتقل للتنفيذ
  return (
    <NextActionCard
      icon="✅"
      title="مبادراتك مرتَّبة — انتقل للتنفيذ"
      reason="أنت في المرحلة ⑥ — حوّل المبادرات إلى خطوات تنفيذ زمنيّة عبر مركز التنفيذ."
      to={`/execute${clientQS}`}
      cta="افتح التنفيذ"
      variant="emerald"
    />
  )
}

function TabBar({ activeTab, onSwitch, strategyPath, filterKeys }: {
  activeTab: TabKey
  onSwitch: (t: TabKey) => void
  strategyPath: StrategyPath | null
  filterKeys?: TabKey[] | null // إن مُرِّرت، لا نُظهر إلّا التبويبات المُرشَّحة
}) {
  const visible = filterKeys ? TABS.filter((t) => filterKeys.includes(t.key)) : TABS
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-2">
      {visible.map((t) => {
        const active = t.key === activeTab
        const dimmed = strategyPath && t.outOfPath?.includes(strategyPath)
        return (
          <Button
            key={t.key}
            variant={active ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSwitch(t.key)}
            className={`gap-1.5 ${dimmed && !active ? 'opacity-50' : ''}`}
            title={dimmed ? t.outOfPathReason : undefined}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {dimmed && !active && <span className="mr-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">خارج مسارك</span>}
          </Button>
        )
      })}
      {filterKeys && (
        <span className="mr-auto self-center rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
          🚨 وضع الطوارئ — عرض ٣ تبويبات فقط
        </span>
      )}
    </div>
  )
}
