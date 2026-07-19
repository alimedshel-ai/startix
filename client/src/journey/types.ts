// ─── طبقة المسار الموجّه — الأنواع المشتركة (محايدة تماماً) ──────────
// المصدر: «أوامر التعديل — مسار موجّه للمدير المستقل» §١-٢.
//
// ⛔ القاعدة الحاكمة: الخطط الثلاث منفصلة تماماً. هذا الملف يحمل الأنواع
// فقط (بلا حالة ولا منطق) — كل خطة تُعرَّف في ملفها المستقل تحت paths/.
// لا يُسمح بمشاركة أي حالة قابلة للتغيّر بين تعريفات الخطط الثلاث.

import type { StageId } from '@/lib/journeyStages'
import type { StrategyPath } from '@/types/user'

/** وجهة المرحلة: مسار ثابت، أو الرمز '@audit' الذي يُحَلّ إلى تدقيق الإدارة حسب التخصّص. */
export type StepDestination = string // '@audit' | '/swot' | '/measure' | …

export interface JourneyStep {
  stageId: StageId
  /** عنوان المرحلة **بأسلوب هذه الخطة** (قد يختلف نصّاً بين الخطط). */
  titleAr: string
  /** تأطير/تركيز المرحلة الخاص بهذه الخطة (نصّ مستقل لكل خطة). */
  emphasisAr: string
  /** الأدوات/الأطر المُبرَزة في هذه المرحلة لهذه الخطة (تُفلتَر حسب سياق الإدارة عند القراءة). */
  highlightedTools: string[]
  /** رابط الوجهة (§٢-١) — يفتح هذه المرحلة. */
  destination: StepDestination
}

export interface PathDefinition {
  key: StrategyPath
  labelAr: string
  /** جملة تعريف قصيرة تعكس أفق الخطة. */
  taglineAr: string
  /** تركيز الأفق الخاص بالخطة (H1 / H1+H2 / كل الآفاق). */
  horizonFocusAr: string
  /** مدّة أساس المشروع بالأيام (تشغيلي ٦٠ · تكتيكي ٩٠ · استراتيجي ١٨٠). */
  projectBaseDays: number
  /** مراحل الخطة **بالترتيب** — لكل خطة ترتيبها الخاص. */
  steps: JourneyStep[]
}
