import { auditRouteFor } from '@/journey'
import { classifyClient, reconcileLevel, type ClientClass, type LevelResolution } from '@/journey/classify'
import { getNextStep } from '@/journey/nextStep'
import { useCompanyById } from '@/hooks/useCompanyById'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { useRescue } from '@/hooks/useRescue'
import { analysisPlanFor, ANALYSIS_TOOLS, firstIncompleteAnalysisKey, type CompanySize } from '@/lib/analysisPlan'
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

// SWOT شقّان: تحليل **داخليّ** يملأ القوّة/الضعف، ومسح **خارجيّ** يملأ
// الفرص/التهديدات. نفصلهما لأن تشخيص النضج/التدقيق داخليّ بحت — لا يكفي
// وحده للتوليف. غياب أيّ شقّ = توجيه للمصدر الناقص لا لـ SWOT نصف الفارغ.
const INTERNAL_SWOT_BASES = ['DEPT_DEEP_FULL', 'DEPT_DEEP_ANSWERS', 'MATURITY', 'INTERNAL_ENV', 'VALUE_CHAIN', 'CORE_CAPABILITIES', 'ORG_DNA', 'GAP_ANALYSIS']
const EXTERNAL_SWOT_BASES = ['PESTEL', 'PORTER', 'BENCHMARK', 'STAKEHOLDERS']

export interface GuidedResult {
  loading: boolean
  next: GuidedNext | null
  /** المستوى المتكيّف المُشتقّ من الصحّة — لمؤشّر «مستواك الآن». */
  classification: ClientClass | null
  /** مصالحة الآليّ↔اليدويّ + كشف التقادم (شارة «ترقَّ/تنبيه»). */
  resolution: LevelResolution | null
}

export function useGuidedNext(companyId: string | null): GuidedResult {
  const user = useAuthStore((s) => s.user)
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const specialty = user?.specialtyDeptType ?? null

  const { loading: cLoading, completions, artifactTypes } = useJourneyCompletions(companyId)
  const { loading: rLoading, rescue, criticalPct, reauditPath, health } = useRescue(isPro ? companyId : null)
  // بيانات الشركة **بالمعرّف المُمرَّر** لا من الـURL — فتُحسب خطّة التحليل ①
  // للعميل المعروض فعلاً على كل الأسطح (لا لشركة «أولى» عشوائيّة). يُشترط pro
  // (قسم ١.٥ يخصّ المدير المستقل وحده).
  const { company, loading: coLoading } = useCompanyById(isPro ? companyId : null)
  const clientQ = companyId ? `?client=${companyId}` : ''

  if (cLoading || rLoading || coLoading) return { loading: true, next: null, classification: null, resolution: null }

  // ─── صنّف: المستوى يُشتقّ من الصحّة ويتكيّف (لا اختيار يدويّ ثابت) ───
  const classification = classifyClient(health)
  // مصالحة المشتقّ (آليّ) مع اختيار المستخدم (يدويّ) → شارة التقادم.
  const resolution = reconcileLevel(classification, user?.strategyPath ?? null)
  // المسار المُشتقّ يقود المحرّك؛ يسقط على اليدويّ حين لا تدقيق بعد (assess).
  const path = classification.journeyPath ?? user?.strategyPath ?? 'LONG'

  // ١) الطوارئ أوّلاً — تتجاوز مراحل المسار.
  if (rescue.kind === 'rescue' && rescue.step) {
    const s = rescue.step
    return { loading: false, classification, resolution, next: {
      kind: 'rescue', icon: '🚨', label: `${s.label} — ${s.tool}`, reason: s.why,
      to: `${s.toolPath}${clientQ}&from=emergency`,
    } }
  }
  if (rescue.kind === 'rescue-done') {
    return { loading: false, classification, resolution, next: {
      kind: 'reaudit', icon: '🔁',
      label: `أعِد تدقيق الإدارة${criticalPct != null ? ` — الصحّة ما زالت ${criticalPct}٪` : ''}`,
      reason: 'الخروج من المنطقة الحمراء يتأكّد بإعادة التدقيق (≥٤٠٪)، لا بمجرّد فعل خطوات الإنقاذ.',
      to: `${reauditPath ?? auditRouteFor(specialty) ?? '/manager/clients'}${clientQ}`,
    } }
  }

  // ١.٥) تسلسل التحليل ①: ما دام المدير المستقل لم يُكمل خطّة التحليل
  //   الموصى بها لسياق شركته (حجم × قطاع × صحّة)، نمشي على التسلسل بالترتيب
  //   (تدقيق → عميق → 7S → … → PESTEL) بدل القفز لمتطلّبات SWOT الخارجيّة.
  //   يمنع تناقض «أنهيت ① فأكمل PESTEL» بينما المدير ما زال داخل التحليل.
  if (isPro && companyId && company?.id === companyId) {
    const plan = analysisPlanFor({
      size: (company.size as CompanySize) ?? 'SMALL',
      sector: company.sector ?? null,
      serviceType: company.profile?.serviceType ?? null,
      healthPct: health.healthPct,
      dangerZone: health.dangerZone,
    })
    const isDone = (key: string): boolean => {
      const t = ANALYSIS_TOOLS[key]
      if (!t) return true
      if (t.viaAudit) return health.hasAudit
      return t.artifactBases.some((b) => artifactSatisfies(artifactTypes, b))
    }
    const nextKey = firstIncompleteAnalysisKey(plan.recommended, isDone)
    if (nextKey) {
      const t = ANALYSIS_TOOLS[nextKey]
      const to = t.viaAudit ? auditRouteFor(specialty) ?? '/manager/clients' : t.path
      const idx = plan.recommended.indexOf(nextKey)
      // فرع «لا صحّة بعد» صريح: بلا تدقيق لا خطّ أساس — الرسالة الموحّدة عبر
      // كل الأسطح «ابدأ بالتدقيق الأول لبناء خط الأساس»، لا سبب تسلسل عامّ.
      const noBaseline = t.viaAudit && !health.hasAudit
      return { loading: false, classification, resolution, next: {
        kind: 'action', icon: t.icon, label: t.label,
        reason: noBaseline
          ? 'ابدأ بالتدقيق الأول لبناء خط الأساس — بلا صحّة مُقاسة لا توصية ولا إنقاذ.'
          : `الخطوة ${idx + 1} من ${plan.recommended.length} في تحليل ① (${plan.tierLabel}) — تابِع بالترتيب قبل الانتقال للتوليف.`,
        to: `${to}${clientQ}`,
      } }
    }
  }

  // ٢) وجّه: المحرّك النقيّ المختبَر بالمسار المُشتقّ (مع إشارات منع الطريق المسدود).
  // داخليّ = artifact داخليّ أو تدقيق إدارة فعليّ (كلاهما يملأ القوّة/الضعف).
  const swotSourcesReady =
    INTERNAL_SWOT_BASES.some((b) => artifactSatisfies(artifactTypes, b)) || health.hasAudit
  const externalSourceReady = EXTERNAL_SWOT_BASES.some((b) => artifactSatisfies(artifactTypes, b))
  const usesDiagnostic = specialty != null && !!MATURITY_BY_SPECIALTY[specialty]
  const r = getNextStep({
    isPro, activeCompanyId: companyId, completions, path, specialty,
    signals: { swotSourcesReady, externalSourceReady, usesDiagnostic },
  })
  return { loading: false, classification, resolution, next: {
    kind: r.kind, icon: r.icon, label: r.label, reason: r.reason,
    to: r.toolPath ? `${r.toolPath}${clientQ}` : null,
    unlockHint: r.unlockHint,
  } }
}
