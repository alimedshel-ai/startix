import { useEffect, useState } from 'react'

import { auditRouteFor } from '@/journey'
import { getRescueNext, type RescueDone, type RescueResult } from '@/journey/rescue'
import { listDepartments } from '@/lib/deptApi'
import { listAllArtifacts, listProjects } from '@/lib/strategicApi'

// ─── هوك «وعي الطوارئ» — الغلاف الذي يجمع الحالة للدالّة النقيّة ──────
// طبقة *فوق* المحرّك: لا يلمس useJourneyCompletions ولا المراحل. يجلب بيانات
// العميل محليّاً، يحسب criticalHealth + done، ويمرّرهما لـ getRescueNext.
// يُستهلَك في القمرة فقط حاليّاً — فالأسطح الـ٢٥ تبقى سليمة.

const NO_DONE: RescueDone = { risk: false, eisenhower: false, raci: false, gantt: false }
const INACTIVE: RescueResult = getRescueNext({ criticalHealth: false, done: NO_DONE })

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

const NO_HEALTH = { hasAudit: false, healthPct: null, dangerZone: null } as const

export function useRescue(companyId: string | null): RescueView {
  const [state, setState] = useState<RescueView>({ loading: !!companyId, rescue: INACTIVE, done: NO_DONE, criticalPct: null, reauditPath: null, health: NO_HEALTH })

  useEffect(() => {
    if (!companyId) {
      setState({ loading: false, rescue: INACTIVE, done: NO_DONE, criticalPct: null, reauditPath: null, health: NO_HEALTH })
      return
    }
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      const [depts, arts, projs] = await Promise.allSettled([
        listDepartments(companyId).catch(() => []),
        listAllArtifacts(companyId).catch(() => []),
        listProjects(companyId).catch(() => []),
      ])
      if (!alive) return
      // الحالة الحرجة: أدنى درجة تدقيق إدارة < ٤٠٪. «الخروج» لا يتحقّق بفعل خطوات
      // الإنقاذ — بل بإعادة التدقيق التي تُظهر تعافياً (auditScore ≥ ٤٠).
      const deptList = depts.status === 'fulfilled' ? depts.value : []
      const criticalDept = deptList.find((d) => d.auditScore != null && d.auditScore < 40)
      // الإدارة الأساسيّة (أوّل من لها تدقيق) — لصحّة classifyClient المتكيّفة.
      const primaryDept = deptList.find((d) => d.auditScore != null)
      const criticalHealth = !!criticalDept
      const types = new Set<string>(arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : [])
      const done: RescueDone = {
        risk: types.has('RISK_REGISTER'),
        eisenhower: types.has('EISENHOWER'),
        raci: types.has('RACI'),
        gantt: projs.status === 'fulfilled' && projs.value.length > 0,
      }
      setState({
        loading: false,
        rescue: getRescueNext({ criticalHealth, done }),
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

  return state
}
