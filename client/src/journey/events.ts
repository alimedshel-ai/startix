// ─── سجلّ أحداث الرحلة (journey_events) — خطّة الإصلاح ن٢ · الموجة ١ ───
// دالّة نقيّة قابلة للاختبار: تبني حدث «الخروج عن التوصية» فقط. لا تخزّن.
//
// الحقل: journey_events في سجل الشركة (خادميّاً) — يُملأ في الموجة ٣ حين
//        يفتح المستخدم أداةً غير الموصى بها (بدل القفل السابق).
// المُستهلك (مُعلَن، لا دَين): تقرير «الحرية مقابل التوصية» في لوحة المالك
//        الشهريّة (الموجة ٤) — يقيس هل الترتيب المقترح يخدم أم يعيق، ويُضبط
//        به ترتيب journey لاحقاً بالأدلّة.
// بلا هذا المُستهلك المُعلَن كان التسجيل دَيناً؛ الآن له مالك واستخدام.

import type { StageId } from '@/lib/journeyStages'

export interface JourneyOverrideEvent {
  type: 'override'
  /** الأداة التي فتحها المستخدم فعلاً. */
  tool: string
  /** الأداة التي كانت موصى بها في تلك اللحظة. */
  recommended_tool: string
  /** المرحلة التي حدث فيها الخروج. */
  stage: StageId
  /** طابع زمنيّ ISO — يُمرَّر من المُسجِّل (الموجة ٣)، لا يُولَّد هنا (نقاء). */
  timestamp: string
}

/** نقيّة: تبني حدث خروج عن التوصية. تُرجع null إن طابقت الأداةُ الموصى بها (لا خروج). */
export function buildOverrideEvent(args: {
  tool: string
  recommendedTool: string
  stage: StageId
  timestamp: string
}): JourneyOverrideEvent | null {
  if (!args.tool || args.tool === args.recommendedTool) return null
  return {
    type: 'override',
    tool: args.tool,
    recommended_tool: args.recommendedTool,
    stage: args.stage,
    timestamp: args.timestamp,
  }
}
