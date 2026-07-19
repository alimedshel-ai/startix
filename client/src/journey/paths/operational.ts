// ─── الخطة التشغيليّة (QUICK) — تعريف مستقل تماماً ──────────────────
// أفق: يوم / شهر · تركيز H1 · مدّة أساس المشروع ٦٠ يوم.
// المراحل: ① التشخيص → ② التوليف → ⑤ المبادرات → ⑥ التنفيذ. (تُطوى ③④.)
//
// ⛔ لا تستورد هذا الملف حالةً من خطة أخرى ولا تخلط نصوصه. النصوص هنا
// تشغيليّة الأسلوب (سرعة، تنفيذ فوري، نتائج قريبة) وتخصّ هذه الخطة وحدها.

import type { PathDefinition } from '../types'

export const OPERATIONAL_PATH: PathDefinition = {
  key: 'QUICK',
  labelAr: '⚡ مسار تشغيلي (قصير)',
  taglineAr: 'تشخيص سريع ثم تنفيذ فوري — نتائج خلال أسابيع.',
  horizonFocusAr: 'الأفق القريب H1 (٠–٣ أشهر)',
  projectBaseDays: 60,
  steps: [
    {
      stageId: 'environment',
      titleAr: '① تدقيق سريع للإدارة',
      emphasisAr: 'ابدأ بتدقيق إدارتك الأساسي — صورة فورية عن أين تقف الآن.',
      highlightedTools: ['@audit', '/manager/deep-analysis'],
      destination: '@audit',
    },
    {
      stageId: 'synthesis',
      titleAr: '② توليف سريع (SWOT)',
      emphasisAr: 'حوّل نتيجة التدقيق إلى نقاط قوّة وضعف واضحة — بلا تعقيد.',
      highlightedTools: ['/swot'],
      destination: '/swot',
    },
    {
      stageId: 'initiatives',
      titleAr: '⑤ مبادرات سريعة',
      emphasisAr: 'التقط ٢-٣ مبادرات عالية الأثر قابلة للتنفيذ هذا الشهر.',
      highlightedTools: ['/priority'],
      destination: '/priority',
    },
    {
      stageId: 'execution',
      titleAr: '⑥ نفّذ وتابِع',
      emphasisAr: 'حوّل المبادرات إلى مهام بتواريخ ومسؤولين، وتابع التقدّم أسبوعياً.',
      highlightedTools: ['/execute'],
      destination: '/execute',
    },
  ],
}
