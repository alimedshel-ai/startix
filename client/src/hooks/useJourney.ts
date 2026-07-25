import { useLocation } from 'react-router-dom'

import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { canOpenStage, filterToolsForUser, overallProgressPct, type StageId } from '@/lib/journeyStages'
import { resolveDestination, resolvePath, stageForPath, type JourneyStep, type PathDefinition } from '@/journey'
import { useAuthStore } from '@/store/authStore'

// ─── §٢ — الهوك الموحّد للمسار الموجّه ─────────────────────────────
// يقرأ user.strategyPath ويحمّل **تعريف تلك الخطة فقط** (resolvePath)،
// ثم يحسب حالة كل مرحلة من اكتمال العميل النشط + منطق القفل القائم.
//
// لا يقرأ أي مكوّن عرضٍ المراحلَ مباشرةً — الكل يمرّ عبر هذا الهوك حتى
// يبقى الفصل بين الخطط الثلاث مضموناً في مكان واحد (§٢-٣).
//
// companyId يُمرَّر من الصفحة (التي تحمله أصلاً عبر useClientScopedCompany)
// تفادياً لطلب شبكة مكرّر — تماماً كنمط NextStepCard.

export type StepStatus = 'done' | 'current' | 'available' | 'locked'

export interface JourneyStepView extends JourneyStep {
  /** الوجهة الفعليّة بعد حلّ '@audit' حسب تخصّص المستخدم. */
  href: string
  /** الأدوات المُبرَزة بعد فلترة سياق الإدارة (نسخ الشركة تُحذف للمستقل). */
  tools: string[]
  status: StepStatus
  /** رقم الخطوة ضمن مسار الخطة (يبدأ من ١). */
  index: number
}

export interface Journey {
  loading: boolean
  path: PathDefinition
  steps: JourneyStepView[]
  total: number
  /** المرحلة المطابقة للصفحة الحاليّة (إن كانت ضمن المسار). */
  currentStage: JourneyStepView | null
  /** المرحلة التالية غير المكتملة في مسار الخطة (بوصلة «التالي»). */
  nextStage: JourneyStepView | null
  /** موضع «أنت هنا»: رقم الخطوة الحاليّة / الإجمالي (للعدّاد). */
  currentIndex: number
  progressPct: number
}

export function useJourney(companyId: string | null): Journey {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const strategyPath = user?.strategyPath ?? null
  const specialty = user?.specialtyDeptType ?? null
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    specialty != null

  const path = resolvePath(strategyPath)
  const { loading, completions } = useJourneyCompletions(companyId)

  const activeStageId: StageId | null = stageForPath(pathname)

  const steps: JourneyStepView[] = path.steps.map((step, i) => {
    const done = completions[step.stageId] === true
    const isCurrent = step.stageId === activeStageId
    let status: StepStatus
    if (isCurrent) status = 'current'
    else if (done) status = 'done'
    else if (canOpenStage(step.stageId, completions, strategyPath)) status = 'available'
    else status = 'locked'
    return {
      ...step,
      href: resolveDestination(step.destination, specialty),
      tools: filterToolsForUser(step.highlightedTools.filter((t) => t !== '@audit'), isDeptScoped),
      status,
      index: i + 1,
    }
  })

  const currentStage = steps.find((s) => s.status === 'current') ?? null
  // «التالي»: أوّل مرحلة غير مكتملة بعد الحاليّة ضمن مسار الخطة.
  const startAfter = currentStage ? currentStage.index : 0
  const nextStage =
    steps.find((s) => s.index > startAfter && s.status !== 'done') ??
    steps.find((s) => s.status !== 'done') ??
    null

  return {
    loading,
    path,
    steps,
    total: steps.length,
    currentStage,
    nextStage,
    currentIndex: currentStage?.index ?? 0,
    progressPct: overallProgressPct(completions, strategyPath),
  }
}
