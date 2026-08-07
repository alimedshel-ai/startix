import { useCallback, useEffect, useState } from 'react'

import { auditRouteFor } from '@/journey'
import {
  getRescueNext, resolveRescuePlan, pickWeakestAxis, selectCompanyHealth,
  type RescueDone, type RescueResult, type RescuePlanResult, type RescueProgress, type AuditAxis,
} from '@/journey/rescue'
import { listDepartments } from '@/lib/deptApi'
import { listAllArtifacts, listProjects, listInitiatives, listCorrections, type RescueChallengesData } from '@/lib/strategicApi'

/** بند تحدٍّ مُضاف من العميل (للعرض في خطوة الإجراء). */
export type RescueChallenge = RescueChallengesData['items'][number]

// ─── هوك «وعي الطوارئ» — الغلاف الذي يجمع الحالة للدالّة النقيّة ──────
// طبقة *فوق* المحرّك: لا يلمس useJourneyCompletions ولا المراحل. يجلب بيانات
// العميل محليّاً، يحسب criticalHealth + done، ويمرّرهما لـ getRescueNext.
//
// نمط الجلب: الـeffect لا يستدعي setState متزامناً إطلاقاً — فقط setFetched
// *بعد await*. أمّا loading والحالة الفارغة فيُشتقّان أثناء الرندر من مطابقة
// forId ↔ companyId. يُزيل خطأ react-hooks/set-state-in-effect من جذره.
//
// الرقعة C: يحسب أيضاً الخطّة الدلاليّة الجديدة (resolveRescuePlan) بجانب
// القديمة (getRescueNext) — الأسطح تختار بينهما عبر flag USE_RESCUE_PLAN.
//   • axisPicked: مُشتقّ آليّاً من pickWeakestAxis على محاور التدقيق (لا تخزين).
//   • actionRecorded: إعادة استخدام Correction — وجود إجراء تصحيحيّ منفّذ (done).
//   • initiativeCreated: مبادرة بوسم source='rescue' (listInitiatives).

const NO_DONE: RescueDone = { risk: false, eisenhower: false, raci: false, gantt: false }
const NO_PROGRESS: RescueProgress = { axisPicked: false, challengesVisited: false, actionRecorded: false, initiativeCreated: false }
const INACTIVE: RescueResult = getRescueNext({ criticalHealth: false, done: NO_DONE })
const INACTIVE_PLAN: RescuePlanResult = resolveRescuePlan({ criticalHealth: false, healthPct: null, progress: NO_PROGRESS })
const NO_HEALTH = { hasAudit: false, healthPct: null, dangerZone: null } as const

export interface RescueView {
  loading: boolean
  rescue: RescueResult
  /** حالة كل خطوة — لرسم الخطّ الزمنيّ في القمرة (النموذج القديم). */
  done: RescueDone
  /** الرقعة C — الخطّة الدلاليّة (محور ← إجراء ← مبادرة ← إعادة تدقيق). */
  plan: RescuePlanResult
  /** الرقعة C — تقدّم الخطوات الدلاليّة (مُشتقّ من البيانات الحقيقيّة). */
  progress: RescueProgress
  /** تحدّيات العميل المُضافة (خطوة challenges) — تُعرَض في خطوة الإجراء. */
  challenges: RescueChallenge[]
  /** الرقعة C — المحور الأضعف (خطوة ١) المُشتقّ من محاور التدقيق. */
  weakestAxis: AuditAxis | null
  /** الرقعة C — معرّف الإجراء التصحيحيّ الأحدث (خطوة ٢) لربط المبادرة (خطوة ٣). */
  actionId: string | null
  /** درجة تدقيق الإدارة الحرجة (٪) — للرسائل: «ما زالت الصحّة X٪». */
  criticalPct: number | null
  /** مسار إعادة تدقيق الإدارة الحرجة — «الخروج» يتأكّد بإعادة القياس لا بفعل الخطوات. */
  reauditPath: string | null
  /** صحّة الإدارة الأساسيّة — يغذّي classifyClient (المستوى المتكيّف). */
  health: { hasAudit: boolean; healthPct: number | null; dangerZone: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | null }
  /** الرقعة C — إعادة تحميل بعد إنشاء inline (إجراء/مبادرة) لتحديث التقدّم. */
  reload: () => void
}

// النتيجة المحسوبة لعميلٍ بعينه (بلا loading — يُشتقّ). forId يربطها بالعميل.
interface Fetched {
  forId: string | null
  rescue: RescueResult
  done: RescueDone
  plan: RescuePlanResult
  progress: RescueProgress
  challenges: RescueChallenge[]
  weakestAxis: AuditAxis | null
  actionId: string | null
  criticalPct: number | null
  reauditPath: string | null
  health: RescueView['health']
}

const EMPTY_FETCHED: Fetched = {
  forId: null, rescue: INACTIVE, done: NO_DONE, plan: INACTIVE_PLAN, progress: NO_PROGRESS,
  challenges: [], weakestAxis: null, actionId: null, criticalPct: null, reauditPath: null, health: NO_HEALTH,
}

export function useRescue(companyId: string | null): RescueView {
  const [fetched, setFetched] = useState<Fetched>(EMPTY_FETCHED)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (!companyId) return
    let alive = true
    ;(async () => {
      const [depts, arts, projs, inis, corrs] = await Promise.allSettled([
        listDepartments(companyId).catch(() => []),
        listAllArtifacts(companyId).catch(() => []),
        listProjects(companyId).catch(() => []),
        listInitiatives(companyId).catch(() => []),
        listCorrections(companyId).catch(() => []),
      ])
      if (!alive) return
      const deptList = depts.status === 'fulfilled' ? depts.value : []
      // الحالة الحرجة: درجة تدقيق < ٤٠٪ أو منطقة حمراء (RED تُجبر الطوارئ مهما
      // كانت النسبة — موائمةً لـclassify/analysisPlan). «الخروج» لا يتحقّق بفعل
      // الخطوات بل بإعادة تدقيق تُظهر تعافياً (auditScore ≥ ٤٠).
      const criticalDept = deptList.find(
        (d) => (d.auditScore != null && d.auditScore < 40) || d.auditData?.dangerZone === 'RED',
      )
      const types = new Set<string>(arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : [])
      const done: RescueDone = {
        risk: types.has('RISK_REGISTER'),
        eisenhower: types.has('EISENHOWER'),
        raci: types.has('RACI'),
        gantt: projs.status === 'fulfilled' && projs.value.length > 0,
      }
      const criticalHealth = !!criticalDept

      // ── الرقعة C — تقدّم الخطوات الدلاليّة من البيانات الحقيقيّة ──
      // خطوة ١ (axisPicked): مُشتقّ — متى توفّرت محاور التدقيق يُعرَف الأضعف آليّاً.
      const axisData = criticalDept?.auditData ?? null
      const weakestAxis = axisData
        ? pickWeakestAxis({ governance: axisData.governance, financial: axisData.financial, team: axisData.team, digital: axisData.digital })
        : null
      // خطوة ٢ (actionRecorded): إعادة استخدام Correction — وجود إجراء تصحيحيّ
      // مُسجَّل (يُنشأ inline). لا مفتاح تمييز على Correction عمداً (لا تخزين
      // جديد) — على عميلٍ حرج يكون الإجراء التصحيحيّ هو فعل الإنقاذ الطبيعيّ.
      const corrList = corrs.status === 'fulfilled' ? corrs.value : []
      const actionRecorded = corrList.length > 0
      const actionId = corrList[0]?.id ?? null
      // خطوة ٣ (initiativeCreated): مبادرة بوسم source='rescue'.
      const iniList = inis.status === 'fulfilled' ? inis.value : []
      const initiativeCreated = iniList.some((i) => i.source === 'rescue')
      // خطوة challenges (اختياريّة): «زار» = **وجود** artifact RESCUE_CHALLENGES
      // (أضاف أو تخطّى)؛ قائمة العرض = items الفعليّة (محتوى — التخطّي items:[]).
      const challengesVisited = types.has('RESCUE_CHALLENGES')
      const challengeArt = arts.status === 'fulfilled'
        ? (arts.value.find((a) => a.type === 'RESCUE_CHALLENGES')?.data as RescueChallengesData | undefined)
        : undefined
      const challenges: RescueChallenge[] = challengeArt?.items ?? []
      const progress: RescueProgress = { axisPicked: weakestAxis != null, challengesVisited, actionRecorded, initiativeCreated }

      setFetched({
        forId: companyId,
        rescue: getRescueNext({ criticalHealth, done }),
        done,
        plan: resolveRescuePlan({ criticalHealth, healthPct: criticalDept?.auditScore ?? null, progress }),
        progress,
        challenges,
        weakestAxis,
        actionId,
        criticalPct: criticalDept?.auditScore ?? null,
        reauditPath: criticalDept ? auditRouteFor(criticalDept.type) : null,
        // صحّة الشركة = الأسوأ عبر الإدارات لا الأوّل ترتيبيّاً (رقعة B): تُطابق
        // مُطلِق الطوارئ (criticalHealth) فلا تناقض «🚨 طوارئ + شارة نموّ».
        health: selectCompanyHealth(
          deptList.map((d) => ({ auditScore: d.auditScore ?? null, dangerZone: d.auditData?.dangerZone })),
        ),
      })
    })().catch(() => {
      // رقعة A — فشلٌ صريح لا تعليقٌ صامت: لو رمت دالّة نقيّة (pickWeakestAxis/
      // resolveRescuePlan) على شكل بيانات مشوّه، الـpromise يُرفض بلا معالجة،
      // setFetched لا يُستدعى، فتُعلَّق الشاشة على loading أبداً. نحسمها لحالةٍ
      // فارغة صريحة لهذا العميل (forId=companyId) فتُحلّ loading.
      if (!alive) return
      setFetched({ ...EMPTY_FETCHED, forId: companyId })
    })
    return () => { alive = false }
  }, [companyId, reloadKey])

  // ── مشتقّ أثناء الرندر (بلا setState متزامن) ──
  if (!companyId) {
    return { loading: false, rescue: INACTIVE, done: NO_DONE, plan: INACTIVE_PLAN, progress: NO_PROGRESS, challenges: [], weakestAxis: null, actionId: null, criticalPct: null, reauditPath: null, health: NO_HEALTH, reload }
  }
  if (fetched.forId !== companyId) {
    // بيانات عميل سابق أو لم تصل بعد → تحميل، بلا عرض حالة قديمة.
    return { loading: true, rescue: INACTIVE, done: NO_DONE, plan: INACTIVE_PLAN, progress: NO_PROGRESS, challenges: [], weakestAxis: null, actionId: null, criticalPct: null, reauditPath: null, health: NO_HEALTH, reload }
  }
  return {
    loading: false,
    rescue: fetched.rescue,
    done: fetched.done,
    plan: fetched.plan,
    progress: fetched.progress,
    challenges: fetched.challenges,
    weakestAxis: fetched.weakestAxis,
    actionId: fetched.actionId,
    criticalPct: fetched.criticalPct,
    reauditPath: fetched.reauditPath,
    health: fetched.health,
    reload,
  }
}
