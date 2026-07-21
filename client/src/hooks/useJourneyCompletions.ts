import { useEffect, useState } from 'react'

import type { StageId } from '@/lib/journeyStages'
import { JOURNEY_STAGES, artifactSatisfies } from '@/lib/journeyStages'
import { getSWOT, listAllArtifacts, listKPIs, listObjectives } from '@/lib/strategicApi'

// ─── قراءة اكتمال المراحل للعميل النشط ───────────────────────────
// Sidebar + JourneyPage يستخدمان نفس المنطق: قائمة artifacts + SWOT +
// Objectives + KPIs → خريطة اكتمال Record<StageId, boolean>.
//
// السلوك:
//   • companyId=null → nothing to fetch, returns all-false + loading=false.
//   • أي فشل شبكة → يُعامَل كـ"غير مكتمل" (لا يُعطّل السايدبار).

export interface JourneyCompletions {
  loading: boolean
  completions: Record<StageId, boolean>
  /** أنواع الـartifacts المحفوظة — لعدّ التحاليل المُنجَزة بدقّة. */
  artifactTypes: Set<string>
}

const EMPTY: Record<StageId, boolean> = {
  environment: false, synthesis: false, directions: false,
  indicators: false, initiatives: false, execution: false,
}

export function useJourneyCompletions(companyId: string | null): JourneyCompletions {
  const [state, setState] = useState<JourneyCompletions>({ loading: false, completions: EMPTY, artifactTypes: new Set() })

  useEffect(() => {
    if (!companyId) {
      setState({ loading: false, completions: EMPTY, artifactTypes: new Set() })
      return
    }
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      try {
        const [arts, swot, objectives, kpis] = await Promise.allSettled([
          listAllArtifacts(companyId),
          getSWOT(companyId).catch(() => null),
          listObjectives(companyId).catch(() => []),
          listKPIs(companyId).catch(() => []),
        ])
        if (!alive) return
        const artifactTypes = new Set<string>(
          arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : [],
        )
        const hasSwot = swot.status === 'fulfilled' && !!swot.value && (
          (swot.value.strengths?.length ?? 0) > 0 ||
          (swot.value.weaknesses?.length ?? 0) > 0
        )
        const hasObjectives = objectives.status === 'fulfilled' && objectives.value.length > 0
        const hasKpis = kpis.status === 'fulfilled' && kpis.value.length > 0

        const completions: Record<StageId, boolean> = { ...EMPTY }
        for (const stage of JOURNEY_STAGES) {
          let done = stage.completionArtifacts.some((t) => artifactSatisfies(artifactTypes, t))
          if (stage.id === 'synthesis' && hasSwot)   done = true
          if (stage.id === 'indicators' && hasObjectives) done = true
          if (stage.id === 'indicators' && hasKpis)  done = true
          completions[stage.id] = done
        }
        setState({ loading: false, completions, artifactTypes })
      } catch {
        if (alive) setState({ loading: false, completions: EMPTY, artifactTypes: new Set() })
      }
    })()
    return () => { alive = false }
  }, [companyId])

  return state
}
