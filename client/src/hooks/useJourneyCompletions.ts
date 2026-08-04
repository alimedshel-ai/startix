import { useEffect, useState } from 'react'

import type { StageId } from '@/lib/journeyStages'
import { JOURNEY_STAGES, artifactSatisfies } from '@/lib/journeyStages'
import { deepHasContent } from '@/lib/artifactContent'
import { listDepartments } from '@/lib/deptApi'
import { classifySaudization, type CategoryInput, type SaudizationStatus } from '@/lib/saudization'
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
  /** أنواع الـartifacts التي محتواها غير فارغ (محفوظ ومملوء) — للقرارات
   *  الواعية بالمحتوى كجاهزية المصدر الخارجيّ. مجموعة موازية لا تعدّل الأمّ. */
  nonEmptyArtifactTypes: Set<string>
  /** حالة التوطين المُشتقّة من HR_QUANT.saudization (من نفس حِمل الـartifacts،
   *  بلا طلب إضافيّ). null إن لا مدخلات توطين — فلا إشارة تُرفَع للرحلة. */
  saudization: { status: SaudizationStatus; gap: number } | null
}

const EMPTY: Record<StageId, boolean> = {
  environment: false, synthesis: false, directions: false,
  indicators: false, initiatives: false, execution: false,
}

export function useJourneyCompletions(companyId: string | null): JourneyCompletions {
  const [state, setState] = useState<JourneyCompletions>({ loading: false, completions: EMPTY, artifactTypes: new Set(), nonEmptyArtifactTypes: new Set(), saudization: null })

  useEffect(() => {
    if (!companyId) {
      setState({ loading: false, completions: EMPTY, artifactTypes: new Set(), nonEmptyArtifactTypes: new Set(), saudization: null })
      return
    }
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    ;(async () => {
      try {
        const [arts, swot, objectives, kpis, depts] = await Promise.allSettled([
          listAllArtifacts(companyId),
          getSWOT(companyId).catch(() => null),
          listObjectives(companyId).catch(() => []),
          listKPIs(companyId).catch(() => []),
          listDepartments(companyId).catch(() => []),
        ])
        if (!alive) return
        const artifactTypes = new Set<string>(
          arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : [],
        )
        // مجموعة موازية: الأنواع التي محتواها غير فارغ فعلاً (تُميّز «محفوظ» عن «مملوء»).
        const nonEmptyArtifactTypes = new Set<string>(
          arts.status === 'fulfilled'
            ? arts.value.filter((a) => deepHasContent(a.data)).map((a) => a.type)
            : [],
        )
        // التوطين من نفس الحِمل: HR_QUANT.saudization → حالة عامّة + فجوة إجماليّة.
        let saudization: JourneyCompletions['saudization'] = null
        if (arts.status === 'fulfilled') {
          const hq = arts.value.find((a) => a.type === 'HR_QUANT')
          const inputs = (hq?.data as { saudization?: CategoryInput[] } | undefined)?.saudization
          if (inputs && inputs.length > 0) {
            const sum = classifySaudization(inputs)
            saudization = { status: sum.overallStatus, gap: sum.totalGap }
          }
        }
        const hasSwot = swot.status === 'fulfilled' && !!swot.value && (
          (swot.value.strengths?.length ?? 0) > 0 ||
          (swot.value.weaknesses?.length ?? 0) > 0
        )
        const hasObjectives = objectives.status === 'fulfilled' && objectives.value.length > 0
        const hasKpis = kpis.status === 'fulfilled' && kpis.value.length > 0
        // تدقيق الإدارة (DeptAuditPage) يُحفَظ في جداول الإدارة لا كـartifact —
        // فنعدّه اكتمالاً لمرحلة «البيئة» (①): أيّ إدارة لها درجة تدقيق فعليّة.
        const hasDeptAudit = depts.status === 'fulfilled' && depts.value.some((d) => d.auditScore != null)

        const completions: Record<StageId, boolean> = { ...EMPTY }
        for (const stage of JOURNEY_STAGES) {
          let done = stage.completionArtifacts.some((t) => artifactSatisfies(artifactTypes, t))
          if (stage.id === 'environment' && hasDeptAudit) done = true
          if (stage.id === 'synthesis' && hasSwot)   done = true
          if (stage.id === 'indicators' && hasObjectives) done = true
          if (stage.id === 'indicators' && hasKpis)  done = true
          completions[stage.id] = done
        }
        setState({ loading: false, completions, artifactTypes, nonEmptyArtifactTypes, saudization })
      } catch {
        if (alive) setState({ loading: false, completions: EMPTY, artifactTypes: new Set(), nonEmptyArtifactTypes: new Set(), saudization: null })
      }
    })()
    return () => { alive = false }
  }, [companyId])

  return state
}
