import { auditRouteFor } from '@/journey'
import { classifyClient, reconcileLevel, type ClientClass, type LevelResolution } from '@/journey/classify'
import { getNextStep } from '@/journey/nextStep'
import { useCompanyById } from '@/hooks/useCompanyById'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { useRescue } from '@/hooks/useRescue'
import { analysisPlanFor, analysisPlanItems, ANALYSIS_TOOLS, type AnalysisTier, type CompanySize } from '@/lib/analysisPlan'
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

// عنصر واحد من خطّة التحليل ① كما يستهلكه أيّ سطح (السايدبار خاصّة): مفتاح
// الأداة + عرضها + وجهتها الكاملة (?client) + حالة الإنجاز + هل هي موصى بها.
export interface GuidedAnalysisItem {
  key: string
  label: string
  icon: string
  /** الوجهة الكاملة (تتضمّن ?client؛ التدقيق عبر auditRouteFor). */
  to: string
  done: boolean
  /** موصى بها (أساسيّة تظهر) أم متقدّمة (تُطوى تحت «إضافية»). */
  recommended: boolean
}

// خطّة التحليل ① المحسوبة مرّة في المحرّك ومُصدَّرة للأسطح — كي يقرأ السايدبار
// نفس المصدر (analysisPlanFor) بدل قائمة ثابتة موازية (مصدر الحقيقة الواحد).
export interface GuidedAnalysisPlan {
  tier: AnalysisTier
  tierLabel: string
  tierIcon: string
  /** العناصر مرتّبة: الموصى به أوّلًا ثمّ المتقدّم. */
  items: GuidedAnalysisItem[]
}

export interface GuidedResult {
  loading: boolean
  next: GuidedNext | null
  /** المستوى المتكيّف المُشتقّ من الصحّة — لمؤشّر «مستواك الآن». */
  classification: ClientClass | null
  /** مصالحة الآليّ↔اليدويّ + كشف التقادم (شارة «ترقَّ/تنبيه»). */
  resolution: LevelResolution | null
  /** خطّة التحليل ① (للمدير المستقل مع عميل مطابق) — يقرؤها السايدبار. */
  analysisPlan: GuidedAnalysisPlan | null
}

export function useGuidedNext(companyId: string | null): GuidedResult {
  const user = useAuthStore((s) => s.user)
  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'
  const specialty = user?.specialtyDeptType ?? null

  const { loading: cLoading, completions, nonEmptyArtifactTypes, saudization } = useJourneyCompletions(companyId)
  const { loading: rLoading, rescue, criticalPct, reauditPath, health } = useRescue(isPro ? companyId : null)
  // بيانات الشركة **بالمعرّف المُمرَّر** لا من الـURL — فتُحسب خطّة التحليل ①
  // للعميل المعروض فعلاً على كل الأسطح (لا لشركة «أولى» عشوائيّة). يُشترط pro
  // (قسم ١.٥ يخصّ المدير المستقل وحده).
  const { company, loading: coLoading } = useCompanyById(isPro ? companyId : null)
  const clientQ = companyId ? `?client=${companyId}` : ''

  if (cLoading || rLoading || coLoading) return { loading: true, next: null, classification: null, resolution: null, analysisPlan: null }

  // ─── صنّف: المستوى يُشتقّ من الصحّة ويتكيّف (لا اختيار يدويّ ثابت) ───
  const classification = classifyClient(health)
  // مصالحة المشتقّ (آليّ) مع اختيار المستخدم (يدويّ) → شارة التقادم.
  const resolution = reconcileLevel(classification, user?.strategyPath ?? null)
  // قرار المالك (2026-08-13): المسار **اليدويّ** يقود المحرّك، مطابقةً لمخطّط القمرة
  // (useJourney يحلّ من نفس strategyPath عبر resolvePath) — فيتّفق السطحان. الطوارئ
  // تبقى شارة (resolution/طبقة الإنقاذ) لا تختصر المسار. بلا اختيار ⇒ استراتيجيّ (كامل)
  // مطابقةً لـresolvePath(null)=STRATEGIC، فلا يبقى مصدرا مسارٍ متعارضان.
  const path = user?.strategyPath ?? 'LONG'

  // ─── خطّة التحليل ① — تُحسب مرّةً هنا (المحرّك analysisPlanFor) وتُصدَّر في كل
  //   عودة كي يقرأ السايدبار نفس المصدر بدل قائمة ثابتة موازية. الوجهة تُبنى مرّة
  //   (viaAudit → auditRouteFor، وإلّا path) + ?client. الطبقة ١٫٥ تعيد استخدامها.
  const analysisPlan: GuidedAnalysisPlan | null =
    isPro && companyId && company?.id === companyId
      ? (() => {
          const plan = analysisPlanFor({
            size: (company.size as CompanySize) ?? 'SMALL',
            sector: company.sector ?? null,
            serviceType: company.profile?.serviceType ?? null,
            healthPct: health.healthPct,
            dangerZone: health.dangerZone,
          })
          // واعٍ بالمحتوى (لا وجوديّ): artifact محفوظ فارغ ({}) لا يُحسب منجَزاً.
          const isDone = (key: string): boolean => {
            const t = ANALYSIS_TOOLS[key]
            if (!t) return true
            if (t.viaAudit) return health.hasAudit
            return t.artifactBases.some((b) => artifactSatisfies(nonEmptyArtifactTypes, b))
          }
          const items: GuidedAnalysisItem[] = analysisPlanItems(plan, isDone).map((it) => {
            const t = ANALYSIS_TOOLS[it.key]
            const base = t?.viaAudit ? auditRouteFor(specialty) ?? '/manager/clients' : t?.path ?? '/manager/clients'
            return { key: it.key, label: it.label, icon: it.icon, done: it.done, recommended: it.recommended, to: `${base}${clientQ}` }
          })
          return { tier: plan.tier, tierLabel: plan.tierLabel, tierIcon: plan.tierIcon, items }
        })()
      : null

  // ١) الطوارئ أوّلاً — تتجاوز مراحل المسار.
  if (rescue.kind === 'rescue' && rescue.step) {
    const s = rescue.step
    return { loading: false, classification, resolution, analysisPlan, next: {
      kind: 'rescue', icon: '🚨', label: `${s.label} — ${s.tool}`, reason: s.why,
      to: `${s.toolPath}${clientQ}&from=emergency`,
    } }
  }
  if (rescue.kind === 'rescue-done') {
    return { loading: false, classification, resolution, analysisPlan, next: {
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
  if (analysisPlan) {
    // نفس عناصر الخطّة التي يعرضها السايدبار — «التالي» = أوّل موصى به غير منجَز.
    const recItems = analysisPlan.items.filter((i) => i.recommended)
    const nextItem = recItems.find((i) => !i.done)
    if (nextItem) {
      const idx = recItems.findIndex((i) => i.key === nextItem.key)
      // فرع «لا صحّة بعد» صريح: التدقيق (viaAudit) بلا hasAudit = لا خطّ أساس.
      const noBaseline = ANALYSIS_TOOLS[nextItem.key]?.viaAudit === true && !health.hasAudit
      return { loading: false, classification, resolution, analysisPlan, next: {
        kind: 'action', icon: nextItem.icon, label: nextItem.label,
        reason: noBaseline
          ? 'ابدأ بالتدقيق الأول لبناء خط الأساس — بلا صحّة مُقاسة لا توصية ولا إنقاذ.'
          : `الخطوة ${idx + 1} من ${recItems.length} في تحليل ① (${analysisPlan.tierLabel}) — تابِع بالترتيب قبل الانتقال للتوليف.`,
        to: nextItem.to,
      } }
    }
  }

  // ٢) وجّه: المحرّك النقيّ المختبَر بالمسار المُشتقّ (مع إشارات منع الطريق المسدود).
  // داخليّ = artifact داخليّ أو تدقيق إدارة فعليّ (كلاهما يملأ القوّة/الضعف).
  // داخليّ (يملأ S/W): كالخارجيّ — يجب أن يكون المصدر مملوءاً لا مجرّد محفوظ.
  // (probe أثبت INTERNAL_ENV={} فارغاً على 3 عملاء؛ تدقيق الإدارة hasAudit يبقى بديلاً.)
  const swotSourcesReady =
    INTERNAL_SWOT_BASES.some((b) => artifactSatisfies(nonEmptyArtifactTypes, b)) || health.hasAudit
  // خارجيّ (يملأ O/T): يجب أن يكون المصدر **مملوءاً** لا مجرّد محفوظ — فنستعمل
  // المجموعة الواعية بالمحتوى. PESTEL محفوظ بلا عوامل ⇒ ليس جاهزاً ⇒ يُوجَّه العميل
  // لإكمال المصدر بدل عرض SWOT بفرص/تهديدات فارغة. (103/126 يبقيان وجوديّين عمداً.)
  const externalSourceReady = EXTERNAL_SWOT_BASES.some((b) => artifactSatisfies(nonEmptyArtifactTypes, b))
  const usesDiagnostic = specialty != null && !!MATURITY_BY_SPECIALTY[specialty]
  const r = getNextStep({
    isPro, activeCompanyId: companyId, completions, path, specialty,
    signals: {
      swotSourcesReady, externalSourceReady, usesDiagnostic,
      saudizationStatus: saudization?.status,
      saudizationGap: saudization?.gap,
    },
  })
  return { loading: false, classification, resolution, analysisPlan, next: {
    kind: r.kind, icon: r.icon, label: r.label, reason: r.reason,
    to: r.toolPath ? `${r.toolPath}${clientQ}` : null,
    unlockHint: r.unlockHint,
  } }
}
