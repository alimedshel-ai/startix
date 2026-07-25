import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { stageForPath } from '@/journey'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { flag, USE_STAGE_LOCK } from '@/lib/flags'
import { canOpenStage, isStageInPath, JOURNEY_STAGES } from '@/lib/journeyStages'
import { useAuthStore } from '@/store/authStore'

// ─── حرس المسار — قفل المراحل الصلب (خلف USE_STAGE_LOCK) ─────────────
// إن حاول المستخدم فتح URL لمرحلة مقفلة (canOpenStage=false) → يُعاد توجيهه
// لمرحلته الحاليّة المتاحة + رسالة. يكمّل قفل السايد بار (لا يُلتَفّ عليه بالـURL).
// لكل الأدوار: يقرأ العميل من ?client= أو شركة المستخدم الأولى (useClientScoped).
// آمن افتراضاً (flag مطفأ) — القفل الصلب يعتمد دقّة كشف الاكتمال، فيبقى اختيارياً.
export function useStageGuard(): void {
  const enabled = flag(USE_STAGE_LOCK)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const scope = useClientScopedCompany()
  const path = useAuthStore((s) => s.user?.strategyPath ?? null)   // واعٍ بالمسار
  const { completions, loading } = useJourneyCompletions(enabled ? scope.companyId : null)

  useEffect(() => {
    if (!enabled || loading || !scope.companyId) return
    const stage = stageForPath(pathname)
    if (!stage) return                               // ليست صفحة مرحلة
    if (canOpenStage(stage, completions, path)) return  // مفتوحة (ضمن مسار المستخدم) — اسمح

    // مقفلة → المرحلة الحاليّة المتاحة **داخل المسار** (أوّل ناقصة قابلة للفتح) + توجيه.
    const current = JOURNEY_STAGES.find(
      (s) => isStageInPath(s.id, path) && !completions[s.id] && canOpenStage(s.id, completions, path),
    )
    const target = `${current?.toolPaths[0] ?? '/dashboard'}?client=${scope.companyId}`
    toast.error(`🔒 أكمل «${current?.labelAr ?? 'المرحلة السابقة'}» أوّلاً قبل هذه المرحلة`)
    navigate(target, { replace: true })
  }, [enabled, pathname, completions, loading, scope.companyId, path, navigate])
}
