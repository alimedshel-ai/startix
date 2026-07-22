import { auditRouteFor } from '@/journey'
import { classifyClient, type ClientClass } from '@/journey/classify'
import { getNextStep } from '@/journey/nextStep'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { useRescue } from '@/hooks/useRescue'
import { artifactSatisfies } from '@/lib/journeyStages'
import { MATURITY_BY_SPECIALTY } from '@/lib/maturityConfigs'
import { useAuthStore } from '@/store/authStore'

// ─── مصدر الحقيقة الوحيد لـ«الخطوة التالية» (C2) ─────────────────────
// يوحّد المحرّكات المبعثرة (useNextStep · NextStepCard · nextStage) في مكان
// واحد. يجمع كل القواعد بالترتيب:
//   ١) الطوارئ (getRescueNext)   — صحّة حرجة → خطوة الإنقاذ / إعادة التدقيق.
//   ٢) المسار (getNextStep النقيّ المختبَر) — الخطوة الطبيعيّة، واعية بمنع
//      الطرق المسدودة (مصادر SWOT).
// أيّ قاعدة عابرة مستقبليّة تُضاف هنا مرّةً واحدة، وكل الأسطح ترثها تلقائيّاً.

export type GuidedKind = 'rescue' | 'reaudit' | 'action' | 'locked' | 'done' | 'no-client'

export interface GuidedNext {
  kind: GuidedKind
  icon: string
  label: string
  reason: string
  /** الوجهة الكاملة (تتضمّن ?client). null لغير القابل للنقر. */
  to: string | null
  /** للـ locked: كيف تُفتَح. */
  unlockHint?: string
}

// أنواع الـartifacts التي تُغذّي SWOT — إن غابت كلّها فالتوليف طريق مسدود.
const SWOT_SOURCE_BASES = ['DEPT_DEEP_FULL', 'DEPT_DEEP_ANSWERS', 'GAP_ANALYSIS', 'PESTEL', 'MATURITY']

export interface GuidedResult {
  loading: boolean
  next: GuidedNext | null
  /** المستوى المتكيّف المُشتقّ من الصحّة — لمؤشّر «مستواك الآن». */
  classification: ClientClass | null
}

export function useGuidedNext(companyId: string | null): GuidedResult {
  const user = useAuthStore((s) => s.user)
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const specialty = user?.specialtyDeptType ?? null

  const { loading: cLoading, completions, artifactTypes } = useJourneyCompletions(companyId)
  const { loading: rLoading, rescue, criticalPct, reauditPath, health } = useRescue(isPro ? companyId : null)
  const clientQ = companyId ? `?client=${companyId}` : ''

  if (cLoading || rLoading) return { loading: true, next: null, classification: null }

  // ─── صنّف: المستوى يُشتقّ من الصحّة ويتكيّف (لا اختيار يدويّ ثابت) ───
  const classification = classifyClient(health)
  // المسار المُشتقّ يقود المحرّك؛ يسقط على اليدويّ حين لا تدقيق بعد (assess).
  const path = classification.journeyPath ?? user?.strategyPath ?? 'LONG'

  // ١) الطوارئ أوّلاً — تتجاوز مراحل المسار.
  if (rescue.kind === 'rescue' && rescue.step) {
    const s = rescue.step
    return { loading: false, classification, next: {
      kind: 'rescue', icon: '🚨', label: `${s.label} — ${s.tool}`, reason: s.why,
      to: `${s.toolPath}${clientQ}&from=emergency`,
    } }
  }
  if (rescue.kind === 'rescue-done') {
    return { loading: false, classification, next: {
      kind: 'reaudit', icon: '🔁',
      label: `أعِد تدقيق الإدارة${criticalPct != null ? ` — الصحّة ما زالت ${criticalPct}٪` : ''}`,
      reason: 'الخروج من المنطقة الحمراء يتأكّد بإعادة التدقيق (≥٤٠٪)، لا بمجرّد فعل خطوات الإنقاذ.',
      to: `${reauditPath ?? auditRouteFor(specialty) ?? '/manager/clients'}${clientQ}`,
    } }
  }

  // ٢) وجّه: المحرّك النقيّ المختبَر بالمسار المُشتقّ (مع إشارات منع الطريق المسدود).
  const swotSourcesReady = SWOT_SOURCE_BASES.some((b) => artifactSatisfies(artifactTypes, b))
  const usesDiagnostic = specialty != null && !!MATURITY_BY_SPECIALTY[specialty]
  const r = getNextStep({
    isPro, activeCompanyId: companyId, completions, path, specialty,
    signals: { swotSourcesReady, usesDiagnostic },
  })
  return { loading: false, classification, next: {
    kind: r.kind, icon: r.icon, label: r.label, reason: r.reason,
    to: r.toolPath ? `${r.toolPath}${clientQ}` : null,
    unlockHint: r.unlockHint,
  } }
}
