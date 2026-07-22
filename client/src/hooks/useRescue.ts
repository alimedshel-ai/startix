import { useEffect, useState } from 'react'

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
}

export function useRescue(companyId: string | null): RescueView {
  const [state, setState] = useState<RescueView>({ loading: !!companyId, rescue: INACTIVE, done: NO_DONE })

  useEffect(() => {
    if (!companyId) {
      setState({ loading: false, rescue: INACTIVE, done: NO_DONE })
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
      // الحالة الحرجة: أدنى درجة تدقيق إدارة < ٤٠٪.
      const criticalHealth = depts.status === 'fulfilled' && depts.value.some((d) => d.auditScore != null && d.auditScore < 40)
      const types = new Set<string>(arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : [])
      const done: RescueDone = {
        risk: types.has('RISK_REGISTER'),
        eisenhower: types.has('EISENHOWER'),
        raci: types.has('RACI'),
        gantt: projs.status === 'fulfilled' && projs.value.length > 0,
      }
      setState({ loading: false, rescue: getRescueNext({ criticalHealth, done }), done })
    })()
    return () => { alive = false }
  }, [companyId])

  return state
}
