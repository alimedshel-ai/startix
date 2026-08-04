// ─── ظلّ D1 — قياسٌ قبل القلب (§٣ من docs/D1_JOURNEYPAGE_SHADOW.md v1.1) ──────
// أداةُ قياسٍ نقيّة: تحسب إكمال المراحل بطريقتين وتُرجع المنشقّة —
//   الوجود (artifactTypes) = مكتمل · المحتوى (nonEmptyArtifactTypes) = غير مكتمل.
// لا تمسّ JourneyPage ولا تغيّر سلوكاً. غرضها إثبات الانحراف **قبل** القلب:
// أداةٌ موجودةٌ فارغة {} تجعل المرحلة «مكتملة» بالوجود بينما المحرّك (المحتوى) لا.

import { JOURNEY_STAGES, artifactSatisfies, type JourneyStage } from './journeyStages'

/** مرحلةٌ منشقّة: الوجود يجعلها مكتملة، والمحتوى لا. */
export interface ShadowDivergence {
  stageId: string
  /** الأنواع التي أرضت الوجود (موجودةٌ لكن فارغة). */
  matchedByExistence: string[]
}

/**
 * يُرجِع المراحل المنشقّة: existenceComplete && !contentComplete.
 * نقيّ — يقبل المجموعتين (والمراحل اختياريّاً) فيُختبَر معزولاً ويُشغَّل حيّاً.
 */
export function shadowStageDivergence(
  artifactTypes: Set<string>,
  nonEmptyArtifactTypes: Set<string>,
  stages: JourneyStage[] = JOURNEY_STAGES,
): ShadowDivergence[] {
  const out: ShadowDivergence[] = []
  for (const stage of stages) {
    const matchedExist = stage.completionArtifacts.filter((t) => artifactSatisfies(artifactTypes, t))
    const contentComplete = stage.completionArtifacts.some((t) => artifactSatisfies(nonEmptyArtifactTypes, t))
    if (matchedExist.length > 0 && !contentComplete) {
      out.push({ stageId: stage.id, matchedByExistence: matchedExist })
    }
  }
  return out
}
