// ─── الخطة الاستراتيجيّة (LONG) — تعريف مستقل تماماً ────────────────
// أفق: ١+ سنة · كل الآفاق H1+H2+H3 · مدّة أساس المشروع ١٨٠ يوم.
// المراحل كاملة: ① التشخيص → ② التوليف → ③ التوجّهات → ④ الأهداف والمؤشرات → ⑤ المبادرات → ⑥ التنفيذ.
//
// ⛔ هذه الخطة الأشمل — لكنها ليست «المسار العام». أسلوبها استراتيجي
// (رؤية، بناء مؤسّسي، مؤشّرات متوازنة). null → تُعامَل كهذه الخطة افتراضياً.

import type { PathDefinition } from '../types'

export const STRATEGIC_PATH: PathDefinition = {
  key: 'LONG',
  labelAr: '🔭 مسار استراتيجي (طويل)',
  taglineAr: 'رحلة كاملة من التشخيص إلى البناء المؤسّسي — أفق سنة فأكثر.',
  horizonFocusAr: 'كل الآفاق H1 + H2 + H3 (٠–٣٦ شهراً فأكثر)',
  projectBaseDays: 180,
  steps: [
    {
      stageId: 'environment',
      titleAr: '① تدقيق الإدارة وتحليل البيئة',
      emphasisAr: 'ابدأ بتدقيق إدارتك ثم حلّل البيئة الكاملة: 7S · PESTEL · بورتر · سلسلة القيمة.',
      highlightedTools: ['@audit', '/internal-environment', '/manager/dept-pestel', '/porter', '/value-chain'],
      destination: '@audit',
    },
    {
      stageId: 'synthesis',
      titleAr: '② التوليف (SWOT ← TOWS)',
      emphasisAr: 'اجمع مخرجات البيئة في SWOT ثم استخرج استراتيجيات TOWS.',
      highlightedTools: ['/swot', '/tows'],
      destination: '/swot',
    },
    {
      stageId: 'directions',
      titleAr: '③ التوجّهات والخيارات',
      emphasisAr: 'التوجّه الاستراتيجي، BMC، الآفاق الثلاثة، الخيارات، BCG، أنسوف.',
      highlightedTools: ['/directions', '/bmc', '/three-horizons', '/choices', '/bcg', '/ansoff'],
      destination: '/directions',
    },
    {
      stageId: 'indicators',
      titleAr: '④ الأهداف والمؤشرات',
      emphasisAr: 'ترجم الاستراتيجية إلى أهداف ومؤشّرات متوازنة: OGSM · KPIs · BSC.',
      highlightedTools: ['/measure'],
      destination: '/measure',
    },
    {
      stageId: 'initiatives',
      titleAr: '⑤ المبادرات والمخاطر',
      emphasisAr: 'مبادرات مرتّبة بالأولويّة + مصفوفة مخاطر + RACI.',
      highlightedTools: ['/priority'],
      destination: '/priority',
    },
    {
      stageId: 'execution',
      titleAr: '⑥ التنفيذ والمتابعة',
      emphasisAr: 'المشاريع، جانت، المهام، ومتابعة المؤشّرات — في مركز واحد.',
      highlightedTools: ['/execute'],
      destination: '/execute',
    },
  ],
}
