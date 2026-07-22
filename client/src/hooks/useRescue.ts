import { useEffect, useState } from 'react'

import { auditRouteFor } from '@/journey'
import { getRescueNext, type RescueDone, type RescueResult } from '@/journey/rescue'
import { listDepartments } from '@/lib/deptApi'
import { listAllArtifacts, listProjects } from '@/lib/strategicApi'

// ─── هوك «وعي الطوارئ» — الغلاف الذي يجمع الحالة للدالّة النقيّة ──────
// طبقة *فوق* المحرّك: لا يلمس useJourneyCompletions ولا المراحل. يجلب بيانات
// العميل محليّاً، يحسب criticalHealth + done، ويمرّرهما لـ getRescueNext.
//
// نمط الجلب: الـeffect لا يستدعي setState متزامناً إطلاقاً — فقط setFetched
// *بعد await*. أمّا loading والحالة الفارغة فيُشتقّان أثناء الرندر من مطابقة
// forId ↔ companyId. يُزيل خطأ react-hooks/set-state-in-effect من جذره.

const NO_DONE: RescueDone = { risk: false, eisenhower: false, raci: false, gantt: false }
const INACTIVE: RescueResult = getRescueNext({ criticalHealth: false, done: NO_DONE })
const NO_HEALTH = { hasAudit: false, healthPct: null, dangerZone: null } as const

export interface RescueView {
  loading: boolean
  rescue: RescueResult
  /** حالة كل خطوة — لرسم الخطّ الزمنيّ في القمرة. */
  done: RescueDone
  /** درجة تدقيق الإدارة الحرجة (٪) — للرسائل: «ما زالت الصحّة X٪». */
  criticalPct: number | null
  /** مسار إعادة تدقيق الإدارة الحرجة — «الخروج» يتأكّد بإعادة القياس لا بفعل الخطوات. */
  reauditPath: string | null
  /** صحّة الإدارة الأساسيّة — يغذّي classifyClient (المستوى المتكيّف). */
  health: { hasAudit: boolean; healthPct: number | null; dangerZone: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | null }
}

// النتيجة المحسوبة لعميلٍ بعينه (بلا loading — يُشتقّ). forId يربطها بالعميل.
interface Fetched {
  forId: string | null
  rescue: RescueResult
  done: RescueDone
  criticalPct: number | null
  reauditPath: string | null
  health: RescueView['health']
}

const EMPTY_FETCHED: Fetched = { forId: null, rescue: INACTIVE, done: NO_DONE, criticalPct: null, reauditPath: null, health: NO_HEALTH }

export function useRescue(companyId: string | null): RescueView {
  const [fetched, setFetched] = useState<Fetched>(EMPTY_FETCHED)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    ;(async () => {
      const [depts, arts, projs] = await Promise.allSettled([
        listDepartments(companyId).catch(() => []),
        listAllArtifacts(companyId).catch(() => []),
        listProjects(companyId).catch(() => []),
      ])
      if (!alive) return
      const deptList = depts.status === 'fulfilled' ? depts.value : []
      // الحالة الحرجة: أدنى درجة تدقيق < ٤٠٪. «الخروج» لا يتحقّق بفعل الخطوات —
      // بل بإعادة تدقيق تُظهر تعافياً (auditScore ≥ ٤٠).
      const criticalDept = deptList.find((d) => d.auditScore != null && d.auditScore < 40)
      // الإدارة الأساسيّة (أوّل من لها تدقيق) — لصحّة classifyClient المتكيّفة.
      const primaryDept = deptList.find((d) => d.auditScore != null)
      const types = new Set<string>(arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : [])
      const done: RescueDone = {
        risk: types.has('RISK_REGISTER'),
        eisenhower: types.has('EISENHOWER'),
        raci: types.has('RACI'),
        gantt: projs.status === 'fulfilled' && projs.value.length > 0,
      }
      setFetched({
        forId: companyId,
        rescue: getRescueNext({ criticalHealth: !!criticalDept, done }),
        done,
        criticalPct: criticalDept?.auditScore ?? null,
        reauditPath: criticalDept ? auditRouteFor(criticalDept.type) : null,
        health: {
          hasAudit: !!primaryDept,
          healthPct: primaryDept?.auditScore ?? null,
          dangerZone: primaryDept?.auditData?.dangerZone ?? null,
        },
      })
    })()
    return () => { alive = false }
  }, [companyId])

  // ── مشتقّ أثناء الرندر (بلا setState متزامن) ──
  if (!companyId) {
    return { loading: false, rescue: INACTIVE, done: NO_DONE, criticalPct: null, reauditPath: null, health: NO_HEALTH }
  }
  if (fetched.forId !== companyId) {
    // بيانات عميل سابق أو لم تصل بعد → تحميل، بلا عرض حالة قديمة.
    return { loading: true, rescue: INACTIVE, done: NO_DONE, criticalPct: null, reauditPath: null, health: NO_HEALTH }
  }
  return {
    loading: false,
    rescue: fetched.rescue,
    done: fetched.done,
    criticalPct: fetched.criticalPct,
    reauditPath: fetched.reauditPath,
    health: fetched.health,
  }
}
