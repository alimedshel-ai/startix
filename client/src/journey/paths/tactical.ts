// ─── الخطة التكتيكيّة (MEDIUM) — تعريف مستقل تماماً ─────────────────
// أفق: ٣–١٢ شهر · تركيز H1 + H2 · مدّة أساس المشروع ٩٠ يوم.
// المراحل: ① التشخيص → ② التوليف → ③ التوجّهات والخيارات → ⑤ المبادرات → ⑥ التنفيذ. (تُطوى ④.)
//
// ⛔ لا تخلط نصوص هذه الخطة مع غيرها. الأسلوب هنا تكتيكي: خيارات،
// مفاضلة، توجيه متوسّط المدى — لا سرعة تشغيليّة ولا شمول استراتيجي.

import type { PathDefinition } from '../types'

export const TACTICAL_PATH: PathDefinition = {
  key: 'MEDIUM',
  labelAr: '🎯 مسار تكتيكي (متوسّط)',
  taglineAr: 'تشخيص فتوجيه فاختيار — خطّة ٣ إلى ١٢ شهراً.',
  horizonFocusAr: 'الأفقان القريب والمتوسّط H1 + H2 (٠–١٢ شهراً)',
  projectBaseDays: 90,
  steps: [
    {
      stageId: 'environment',
      titleAr: '① تدقيق الإدارة وتحليلها',
      emphasisAr: 'ابدأ بتدقيق إدارتك ثم عمّقه بعدسات البيئة (7S · PESTEL) لفهم السياق.',
      highlightedTools: ['@audit', '/internal-environment', '/manager/dept-pestel'],
      destination: '@audit',
    },
    {
      stageId: 'synthesis',
      titleAr: '② التوليف (SWOT ← TOWS)',
      emphasisAr: 'اجمع المخرجات في SWOT ثم حوّلها إلى استراتيجيات عبر TOWS.',
      highlightedTools: ['/swot', '/tows'],
      destination: '/swot',
    },
    {
      stageId: 'directions',
      titleAr: '③ التوجّهات والخيارات',
      emphasisAr: 'حدّد وجهتك وفاضِل بين الخيارات — تحليل الفجوة، BMC، أنسوف.',
      highlightedTools: ['/directions', '/gap-analysis', '/manager/dept-gap', '/choices'],
      destination: '/directions',
    },
    {
      stageId: 'initiatives',
      titleAr: '⑤ المبادرات والأولويّات',
      emphasisAr: 'رتّب المبادرات بالأولويّة وقيّم مخاطرها قبل الإطلاق.',
      highlightedTools: ['/priority'],
      destination: '/priority',
    },
    {
      stageId: 'execution',
      titleAr: '⑥ التنفيذ والمتابعة',
      emphasisAr: 'حوّل الخطّة إلى مشاريع ومهام بجدول زمني، وتابع KPIs دوريّاً.',
      highlightedTools: ['/execute'],
      destination: '/execute',
    },
  ],
}
