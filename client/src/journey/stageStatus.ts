// ─── حالة القسم المرتبط بمرحلة — منطق محرّك (الرقعة F) ───────────────
// كان معرَّفاً محلّياً داخل Sidebar.tsx (منطق قفل داخل مكوّن عرض). نُقل هنا
// ليصبح 🔒 «قفل المراحل» بمالك واحد حقيقيّ في المحرّك، يُعاد تصديره من الباب
// الموحَّد @/journey. نقيّ: يعتمد canOpenStage (المحرّك) + completions فقط.
//
// ملاحظة ملكيّة: هذا هو مالك 🔒 الفعليّ (لا classify.branchLock — تلك احتياطيّ
// غير موصول، انظر رأس classify.ts). لا حالة 'recommended' — الثلاث تكفي.

import { canOpenStage, type StageId } from '@/lib/journeyStages'
import type { StrategyPath } from '@/types/user'

export type StageStatus = 'locked' | 'available' | 'complete'

export function stageStatus(
  stageId: StageId,
  completions: Record<StageId, boolean>,
  path?: StrategyPath | null,   // واعية بالمسار — لا قفل زائف خلف مراحل خارج المسار.
): StageStatus {
  if (completions[stageId]) return 'complete'
  if (canOpenStage(stageId, completions, path)) return 'available'
  return 'locked'
}
