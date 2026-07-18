import type { DeptCode } from '@/lib/deptApi'
import type { StageId } from '@/lib/journeyStages'
import type { ManagerType, SpecialtyDeptType, UserType } from '@/types/user'

// ─── نظام التنقّل الموحّد (SIDEBAR-STRUCTURE.md) ─────────────────
// الطبقات الثلاث:
//   • main    — مسار العمل الأساسي (دائم الظهور، ٥-٨ عناصر)
//   • context — الإدارة والسياق (ثانوي قابل للطيّ، ٢-٤ عناصر)
//   • pinned  — أدوات مساندة مثبَّتة (٣ عناصر ثابتة: 🤖 · ⌘K · ⚙️)
//
// «لا شيء يُدفَن»: كل عنصر يجد بيتاً واضحاً.
// «Hub = تبويبات إلزاميّة»: ما يعرض تبويبات هو Hub، غيره «قسم».

export interface NavItem {
  to: string
  label: string
  icon?: string
  // SEC-2 — يخفي العنصر عن غير المسؤولين. السيرفر يحمي المسار.
  adminOnly?: boolean
  // PRO-F — يربط العنصر بإدارة معيّنة. للمدير المستقل، نُخفي غير المطابق.
  dept?: DeptCode
  // proOnly — للمدير المستقل فقط.
  proOnly?: boolean
  // الأدوات النجميّة الأساسيّة داخل الأقسام القابلة للطيّ.
  essential?: boolean
  // مساندة داخل مرحلة لكنها لا تُحسب في اكتمال المرحلة.
  optional?: boolean
  // ⏳ عنصر مخطّط بلا صفحة بعد — يُعرض بادج «⏳» ويوجّه إلى PlaceholderPage.
  placeholder?: boolean
}

export type AccentColor = 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky' | 'orange'

// طبقة القسم في السايدبار — تحدّد الموقع البصري وإمكانيّة الطيّ.
export type NavLayer = 'main' | 'context' | 'pinned'

export interface NavSection {
  title: string
  accent: AccentColor
  items: NavItem[]
  stageId?: StageId
  collapsible?: boolean
  // الطبقة (SIDEBAR-STRUCTURE.md). افتراضي 'main' لأمان الرجعيّة.
  layer?: NavLayer
  // نوع القسم للعرض — Hub يستحقّ لوناً بارزاً، «قسم» عادي.
  isHub?: boolean
}

// ═══════════════════════════════════════════════════════════════
// المالك (OWNER) — ٦ main + ٤ context + ٣ pinned
// ═══════════════════════════════════════════════════════════════

const ownerNav: NavSection[] = [
  // ─── مسار العمل الأساسي ─────────────────────────────────────
  {
    title: '🏠 نظرة عامّة',
    accent: 'teal',
    layer: 'main',
    items: [
      { to: '/dashboard',    label: 'لوحة القيادة',  icon: '🏠' },
      { to: '/live-board',   label: 'اللوحة الحيّة',  icon: '⚡' },
      { to: '/activity-feed', label: 'سجل النشاط',   icon: '📰' },
    ],
  },
  {
    title: '📖 الخطة الاستراتيجيّة',
    accent: 'indigo',
    layer: 'main',
    items: [
      { to: '/owner/strategic-plan', label: 'خطة الشركة', icon: '🗺️', placeholder: true },
    ],
  },
  {
    title: '🎯 التشخيص',
    accent: 'sky',
    layer: 'main',
    isHub: true,
    collapsible: true,
    items: [
      // ⭐ Hub الرئيسي — رابطٌ لصفحة تجمع كل الأدوات بتبويبات
      { to: '/owner/diagnostic-hub', label: '📚 مركز التشخيص (كل الأدوات)', icon: '🎯', essential: true },
      // الأدوات الفرديّة (قابلة للطيّ)
      { to: '/diagnostic/owner',  label: 'تشخيص المالك', icon: '🎯' },
      { to: '/assessment-wizard', label: 'معالج التقييم', icon: '🧭' },
      { to: '/company-health',    label: 'صحّة الشركة',   icon: '❤️' },
    ],
  },
  {
    title: '🌐 التحليل والتوليف',
    accent: 'violet',
    layer: 'main',
    isHub: true,
    collapsible: true,
    items: [
      // ⭐ Hub الرئيسي
      { to: '/owner/analysis-hub', label: '📚 مركز التحليل (كل الأدوات)', icon: '🌐', essential: true },
      // الأدوات الفرديّة (قابلة للطيّ)
      { to: '/internal-environment', label: 'البيئة الداخليّة (7S)', icon: '🎯' },
      { to: '/pestel',               label: 'تحليل PESTEL',        icon: '🌐' },
      { to: '/porter',               label: 'قوى بورتر الخمس',       icon: '⚔️' },
      { to: '/swot',                 label: 'تحليل SWOT',           icon: '🧭' },
      { to: '/tows',                 label: 'مصفوفة TOWS',           icon: '🔄' },
      { to: '/value-chain',          label: 'سلسلة القيمة',          icon: '🔗' },
      { to: '/core-capabilities',    label: 'القدرات الجوهريّة',      icon: '💎' },
      { to: '/benchmarking',         label: 'المقارنة المرجعيّة',    icon: '🔍' },
      { to: '/stakeholders',         label: 'أصحاب المصلحة',         icon: '👥' },
      { to: '/risk-map',             label: 'خريطة المخاطر',         icon: '⚠️' },
      { to: '/ambition-gap',         label: 'فجوة الطموح',           icon: '🎯' },
      { to: '/strategic-tensions',   label: 'التوترات الاستراتيجيّة',  icon: '⚖️' },
    ],
  },
  {
    title: '🧭 القرار والتوجّه',
    accent: 'amber',
    layer: 'main',
    isHub: true,
    collapsible: true,
    items: [
      // ⭐ Hub الرئيسي
      { to: '/owner/decision-hub', label: '📚 مركز القرار (كل الأدوات)', icon: '🧭', essential: true },
      // الأدوات الفرديّة (قابلة للطيّ)
      { to: '/directions',      label: 'الاتجاهات',              icon: '🧭' },
      { to: '/choices',         label: 'القرار الاستراتيجي',    icon: '✅' },
      { to: '/bmc',             label: 'نموذج الأعمال Canvas',  icon: '🧩' },
      { to: '/ansoff',          label: 'مصفوفة أنسوف',           icon: '📈' },
      { to: '/bcg',             label: 'مصفوفة BCG',             icon: '⭐' },
      { to: '/three-horizons',  label: 'الآفاق الثلاثة',         icon: '🔭' },
      { to: '/scenarios',       label: 'السيناريوهات',           icon: '🔮' },
      { to: '/gap-analysis',    label: 'تحليل الفجوة',           icon: '📐' },
      { to: '/qspm',            label: 'مصفوفة QSPM',            icon: '🧮' },
      { to: '/space',           label: 'مصفوفة SPACE',           icon: '🛰️' },
    ],
  },
  {
    title: '📊 القياس والتنفيذ',
    accent: 'emerald',
    layer: 'main',
    isHub: true,
    collapsible: true,
    items: [
      // ⭐ Hub الرئيسي
      { to: '/owner/measure-execute-hub', label: '📚 مركز القياس والتنفيذ (كل الأدوات)', icon: '📊', essential: true },
      // الأدوات الفرديّة (قابلة للطيّ)
      { to: '/objectives',   label: 'الأهداف الاستراتيجيّة', icon: '🎯' },
      { to: '/kpis',         label: 'مؤشّرات الأداء',        icon: '📊' },
      { to: '/bsc',          label: 'Balanced Scorecard',   icon: '⚖️' },
      // OKRs / OGSM / مصفوفة الأولويّة أُزيلت من التنقّل — صياغات مكرّرة لبيانٍ
      // واحد. المسارات والجداول باقية؛ يُوصَل إليها عبر الـ hub لا كمداخل مستقلّة.
      { to: '/kpi-entries',  label: 'إدخالات المؤشّرات',    icon: '✍️' },
      { to: '/initiatives',     label: 'المبادرات',         icon: '💡' },
      { to: '/eisenhower',      label: 'مصفوفة أيزنهاور',    icon: '📊' },
      { to: '/raci',            label: 'مصفوفة RACI',        icon: '👥' },
      { to: '/projects',    label: 'متابعة المبادرات', icon: '📁' },
      { to: '/annual-plan', label: 'الخطة السنويّة',  icon: '🗓️' },
      { to: '/gantt-chart', label: 'مخطّط جانت',      icon: '📅' },
      { to: '/tasks',       label: 'المهام',         icon: '✓' },
    ],
  },

  // ─── الإدارة والسياق ────────────────────────────────────────
  {
    title: '🏢 الشركات والفريق',
    accent: 'indigo',
    layer: 'context',
    items: [
      { to: '/companies',     label: 'شركاتي',       icon: '🏢' },
      { to: '/companies/add', label: 'إضافة شركة',   icon: '➕' },
      { to: '/invitations',   label: 'دعوات الفريق', icon: '✉️' },
      { to: '/org-dna',       label: 'DNA المنظّمة',  icon: '🧬' },
    ],
  },
  {
    title: '💼 لوحات القيادة',
    accent: 'violet',
    layer: 'context',
    items: [
      { to: '/ceo-dashboard',       label: 'لوحة الرئيس التنفيذي', icon: '👔' },
      { to: '/exec-dashboard',      label: 'لوحة الفريق التنفيذي', icon: '👥' },
      { to: '/board-dashboard',     label: 'لوحة المجلس',          icon: '🏛️' },
      { to: '/analytics-dashboard', label: 'التحليلات',            icon: '📈' },
      { to: '/admin-dashboard',     label: 'لوحة المسؤول',         icon: '🛠️', adminOnly: true },
    ],
  },
  {
    title: '📑 المراجعة والتقارير',
    accent: 'orange',
    layer: 'context',
    items: [
      { to: '/strategic-calendar', label: 'التقويم الاستراتيجي', icon: '🗓️' },
      { to: '/reviews',            label: 'المراجعات',           icon: '🔁' },
      { to: '/corrections',        label: 'الإجراءات التصحيحيّة', icon: '🔧' },
      { to: '/reports',            label: 'التقارير',            icon: '📑' },
    ],
  },
  {
    title: '💰 التحليل المالي',
    accent: 'emerald',
    layer: 'context',
    items: [
      { to: '/financial-analysis', label: 'Dupont و Monte Carlo', icon: '📐' },
    ],
  },

  // ─── مُثبَّت ─────────────────────────────────────────────────
  {
    title: '🤖 الذكاء الاصطناعي',
    accent: 'violet',
    layer: 'pinned',
    items: [
      { to: '/ai-center',       label: 'مركز الذكاء',    icon: '🤖' },
      { to: '/ai/advisor',      label: 'المستشار',       icon: '💬' },
      { to: '/ai/presentation', label: 'مولّد العروض',   icon: '🎞️' },
      { to: '/ai/pain-screen',  label: 'فحص نقاط الألم', icon: '🩺' },
      { to: '/ai/simulation',   label: 'مختبر المحاكاة', icon: '🧪' },
    ],
  },
  {
    title: '⌘K بحث',
    accent: 'sky',
    layer: 'pinned',
    items: [
      { to: '/search', label: 'بحث سريع', icon: '🔍', placeholder: true },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
// المدير (MANAGER) — ٨ main + ٣ context + ٣ pinned
// ═══════════════════════════════════════════════════════════════

const managerNav: NavSection[] = [
  // ─── مسار العمل الأساسي ─────────────────────────────────────
  // (٠ البداية للـINTERNAL فقط — لوحة الإدارة الوحيدة)
  {
    title: '🏠 البداية',
    accent: 'teal',
    layer: 'main',
    items: [
      { to: '/manager/dept-dashboard', label: 'لوحة الإدارة',  icon: '📊' /* INTERNAL only */ },
      { to: '/manager/diagnostic',     label: 'تشخيص المدير',  icon: '🎯' /* INTERNAL only */ },
    ],
  },

  // ① التشخيص Hub
  {
    title: '🌐 ① التشخيص وتحليل البيئة',
    accent: 'sky',
    stageId: 'environment',
    layer: 'main',
    isHub: true,
    collapsible: true,
    items: [
      { to: '/manager/analysis-wizard', label: '🔬 معالج التحليل الشامل', icon: '🪄', proOnly: true, essential: true },
      { to: '/internal-environment',  label: 'البيئة الداخليّة (7S)',    icon: '🏛️', proOnly: true, essential: true },
      { to: '/manager/deep-analysis', label: 'التحليل العميق للإدارة',   icon: '🔬', proOnly: true, essential: true },
      { to: '/manager/dept-pestel',   label: 'PESTEL للإدارة',           icon: '🌍', proOnly: true, essential: true },
      // تدقيق التخصّص (يظهر واحد بحسب dept)
      { to: '/manager/hr/audit',             label: 'تدقيق الموارد البشرية',  icon: '👤', dept: 'HR',                essential: true },
      { to: '/manager/finance/audit',        label: 'تدقيق المالية',          icon: '💰', dept: 'FINANCE',           essential: true },
      { to: '/manager/sales/audit',          label: 'تدقيق المبيعات',         icon: '💼', dept: 'SALES',             essential: true },
      { to: '/manager/marketing/audit',      label: 'تدقيق التسويق',          icon: '📢', dept: 'MARKETING',         essential: true },
      { to: '/manager/marketing/hub',        label: 'مركز التسويق',           icon: '📣', dept: 'MARKETING',         essential: true },
      { to: '/manager/operations/audit',     label: 'تدقيق العمليات',         icon: '⚙️', dept: 'OPERATIONS',        essential: true },
      { to: '/manager/it/audit',             label: 'تدقيق تقنية المعلومات',  icon: '💻', dept: 'IT',                essential: true },
      { to: '/manager/cs/audit',             label: 'تدقيق خدمة العملاء',     icon: '📞', dept: 'CUSTOMER_SERVICE',  essential: true },
      { to: '/manager/logistics/audit',      label: 'تدقيق اللوجستيات',       icon: '🚚', dept: 'LOGISTICS',         essential: true },
      { to: '/manager/quality/audit',        label: 'تدقيق الجودة',           icon: '✅', dept: 'QUALITY',           essential: true },
      { to: '/manager/projects/audit',       label: 'تدقيق المشاريع',         icon: '📋', dept: 'PROJECTS',          essential: true },
      { to: '/manager/governance/audit',     label: 'تدقيق الحوكمة',          icon: '🏛️', dept: 'GOVERNANCE',        essential: true },
      { to: '/manager/compliance/audit',     label: 'تدقيق الامتثال',         icon: '⚖️', dept: 'COMPLIANCE',        essential: true },
      // الموسّعة
      { to: '/value-chain',           label: 'سلسلة القيمة',      icon: '⛓️', proOnly: true },
      { to: '/porter',                label: 'قوى بورتر الخمس',   icon: '⚔️', proOnly: true },
      { to: '/core-capabilities',     label: 'القدرات الجوهريّة', icon: '💎', proOnly: true },
      { to: '/benchmarking',          label: 'المقارنة المرجعيّة', icon: '🎖️', proOnly: true },
      { to: '/org-dna',               label: 'DNA المنظّمة',      icon: '🧬', proOnly: true },
      { to: '/stakeholders',          label: 'أصحاب المصلحة',    icon: '🫂', proOnly: true },
      { to: '/manager/dept-deep',     label: 'التحليل المبسّط',   icon: '📝', proOnly: true, optional: true },
      { to: '/manager/governance/hub',       label: 'مركز الحوكمة',           icon: '🏛️', dept: 'GOVERNANCE' },
      { to: '/manager/compliance/audit-pro', label: 'تدقيق امتثال احترافي',  icon: '🛡️', dept: 'COMPLIANCE' },
    ],
  },

  // ② التوليف
  {
    title: '🧭 ② التوليف',
    accent: 'rose',
    stageId: 'synthesis',
    layer: 'main',
    items: [
      { to: '/swot', label: 'تحليل SWOT',  icon: '🎭', proOnly: true },
      { to: '/tows', label: 'مصفوفة TOWS', icon: '🔀', proOnly: true },
    ],
  },

  // ③ القرار والتوجّه
  {
    title: '🎯 ③ التوجّه والخيارات',
    accent: 'amber',
    stageId: 'directions',
    layer: 'main',
    items: [
      { to: '/directions',       label: 'التوجّه الاستراتيجي',   icon: '🧭', proOnly: true },
      { to: '/bmc',              label: 'نموذج الأعمال Canvas', icon: '🧱', proOnly: true },
      { to: '/manager/dept-gap', label: 'فجوات الإدارة',        icon: '📏', proOnly: true },
      { to: '/gap-analysis',     label: 'فجوات الشركة',         icon: '📐', proOnly: true, optional: true },
      { to: '/ansoff',           label: 'مصفوفة أنسوف',          icon: '🎢', proOnly: true },
      { to: '/bcg',              label: 'مصفوفة BCG',            icon: '🐄', proOnly: true },
      { to: '/choices',          label: 'القرار الاستراتيجي',   icon: '⭐', proOnly: true },
      { to: '/three-horizons',   label: 'الآفاق الثلاثة',        icon: '🔭', proOnly: true },
      { to: '/scenarios',        label: 'السيناريوهات',          icon: '🔮', proOnly: true },
    ],
  },

  // ④ القياس (Hub /measure)
  {
    title: '📊 ④ القياس والأهداف',
    accent: 'emerald',
    stageId: 'indicators',
    layer: 'main',
    items: [
      { to: '/measure',            label: 'الأهداف والمؤشّرات', icon: '📈', proOnly: true, essential: true },
      { to: '/manager/dept-smart', label: 'ذكاء KPIs',           icon: '✨', proOnly: true, optional: true },
    ],
  },

  // ⑤ المبادرات (Hub /priority)
  {
    title: '💡 ⑤ المبادرات والأولويّات',
    accent: 'violet',
    stageId: 'initiatives',
    layer: 'main',
    items: [
      { to: '/priority',      label: 'المبادرات والأولويّات', icon: '💡', proOnly: true, essential: true },
    ],
  },

  // ⑥ التنفيذ (Hub /execute)
  {
    title: '🚀 ⑥ التنفيذ والمتابعة',
    accent: 'orange',
    stageId: 'execution',
    layer: 'main',
    items: [
      { to: '/execute',                   label: 'التنفيذ والمتابعة',    icon: '🚀', proOnly: true, essential: true },
    ],
  },

  // ─── الإدارة والسياق ────────────────────────────────────────
  {
    title: '📑 خطط الإصلاح',
    accent: 'orange',
    layer: 'context',
    items: [
      { to: '/manager/logistics/reform',  label: 'خطة إصلاح اللوجستيات', icon: '🩹', dept: 'LOGISTICS',  optional: true },
      { to: '/manager/compliance/reform', label: 'خطة إصلاح الامتثال',   icon: '🔨', dept: 'COMPLIANCE', optional: true },
    ],
  },
  {
    title: '💰 التحليل المالي',
    accent: 'emerald',
    layer: 'context',
    items: [
      { to: '/financial-analysis',         label: 'Dupont و Monte Carlo', icon: '📉', proOnly: true },
      { to: '/manager/finance/break-even', label: 'نقطة التعادل',         icon: '⚖️', dept: 'FINANCE' },
    ],
  },

  // ─── مُثبَّت ─────────────────────────────────────────────────
  {
    title: '🤖 الذكاء الاصطناعي',
    accent: 'violet',
    layer: 'pinned',
    items: [
      { to: '/ai/simulation', label: 'مختبر المحاكاة', icon: '🧪', proOnly: true, optional: true },
    ],
  },
  {
    title: '⌘K بحث',
    accent: 'sky',
    layer: 'pinned',
    items: [
      { to: '/search', label: 'بحث سريع', icon: '🔍', placeholder: true },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
// المستثمر (INVESTOR) — ٥ main + ٢ context + ٣ pinned
// ═══════════════════════════════════════════════════════════════

const investorNav: NavSection[] = [
  // ─── مسار العمل الأساسي ─────────────────────────────────────
  {
    title: '🏠 نظرة عامّة',
    accent: 'teal',
    layer: 'main',
    isHub: true,
    items: [
      { to: '/investor/dashboard',        label: 'لوحة المستثمر',   icon: '📊', essential: true },
      { to: '/investor/activity',         label: 'سجل النشاط',      icon: '📰', placeholder: true },
      { to: '/investor/alerts',           label: 'التنبيهات',       icon: '🔔', placeholder: true },
    ],
  },
  {
    title: '🎯 التشخيص',
    accent: 'sky',
    layer: 'main',
    isHub: true,
    items: [
      { to: '/investor/diagnostic',       label: 'تشخيص المستثمر',   icon: '🎯', essential: true },
      { to: '/investor/sector-preferences', label: 'تفضيلات القطاع', icon: '🏷️', placeholder: true },
    ],
  },
  {
    title: '💼 المحفظة',
    accent: 'emerald',
    layer: 'main',
    isHub: true,
    items: [
      { to: '/investor/portfolio',        label: 'محفظتي',           icon: '💼', essential: true },
      { to: '/investor/portfolio/compare', label: 'مقارنة الشركات', icon: '⚖️', placeholder: true },
      { to: '/investor/portfolio/sectors', label: 'التوزيع القطاعي', icon: '📊', placeholder: true },
    ],
  },
  {
    title: '📊 التحليل المالي',
    accent: 'violet',
    layer: 'main',
    isHub: true,
    items: [
      { to: '/investor/financial/dupont',  label: 'Dupont Analysis', icon: '📐', placeholder: true },
      { to: '/investor/financial/monte-carlo', label: 'Monte Carlo', icon: '🎲', placeholder: true },
      { to: '/investor/financial/roi',     label: 'ROI محسوب',        icon: '💰', placeholder: true },
      { to: '/investor/financial/reports', label: 'التقارير الماليّة', icon: '📑', placeholder: true },
    ],
  },
  {
    title: '🔍 التقييم والفرز',
    accent: 'amber',
    layer: 'main',
    isHub: true,
    items: [
      { to: '/investor/deals',            label: 'خط الأنابيب',      icon: '🤝', essential: true },
      { to: '/investor/scoring',          label: 'إطار التقييم',     icon: '📊', placeholder: true },
      { to: '/investor/due-diligence',    label: 'العناية الواجبة',  icon: '🔎', placeholder: true },
      { to: '/investor/benchmarking',     label: 'المقارنة المرجعيّة', icon: '🔍', placeholder: true },
    ],
  },

  // ─── الإدارة والسياق ────────────────────────────────────────
  {
    title: '📑 التقارير والملفّات',
    accent: 'orange',
    layer: 'context',
    items: [
      { to: '/investor/reports', label: 'تقارير المستثمر', icon: '📑', placeholder: true },
    ],
  },
  {
    title: '🌐 استكشاف السوق',
    accent: 'indigo',
    layer: 'context',
    items: [
      { to: '/investor/market', label: 'اكتشاف الفرص', icon: '🌐', placeholder: true },
    ],
  },

  // ─── مُثبَّت ─────────────────────────────────────────────────
  {
    title: '🤖 توصيات AI',
    accent: 'violet',
    layer: 'pinned',
    items: [
      { to: '/investor/ai/recommendations', label: 'توصيات استثماريّة', icon: '🤖', placeholder: true },
    ],
  },
  {
    title: '⌘K بحث',
    accent: 'sky',
    layer: 'pinned',
    items: [
      { to: '/search', label: 'بحث سريع', icon: '🔍', placeholder: true },
    ],
  },
]

// ─── أقسام مدرَجة تلقائياً للمدير المستقل ────────────────────────
const proClientsSection: NavSection = {
  title: '🤝 العملاء والمحفظة',
  accent: 'amber',
  layer: 'main',
  items: [
    { to: '/manager/clients',            label: 'عملائي',              icon: '🤝' },
    { to: '/manager/journey-map',        label: 'خريطة المسار',       icon: '🗺️' },
    { to: '/manager/diagnostic',         label: 'تشخيص المدير',       icon: '🎯' },
  ],
}

const strategicPlanSection: NavSection = {
  title: '📖 الخطة الاستراتيجيّة',
  accent: 'indigo',
  layer: 'main',
  items: [
    { to: '/manager/strategic-plan', label: 'خطة الإدارة', icon: '🗺️', proOnly: true, essential: true },
  ],
}

// قسم الإعدادات المُثبَّت — يظهر لكل الأدوار.
const settingsSection: NavSection = {
  title: '⚙️ الإعدادات',
  accent: 'teal',
  layer: 'pinned',
  items: [
    { to: '/settings/path', label: 'مساري الاستراتيجي', icon: '🎯' },
  ],
}

export function navFor(
  userType: UserType | null | undefined,
  managerType?: ManagerType | null,
  specialty?: SpecialtyDeptType | null
): NavSection[] {
  if (userType === 'OWNER') return [...ownerNav, settingsSection]
  if (userType === 'MANAGER') {
    // الترتيب:
    //   INDEPENDENT_PRO → العملاء + الخطة + بقية المراحل + الإعدادات
    //   INTERNAL        → البداية + الخطة + بقية المراحل + الإعدادات
    const base = managerType === 'INDEPENDENT_PRO'
      ? [proClientsSection, strategicPlanSection, ...managerNav]
      : [managerNav[0], strategicPlanSection, ...managerNav.slice(1)]
    const roleFiltered = base.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (managerType === 'INDEPENDENT_PRO' && i.to === '/manager/dept-dashboard') return false
        if (managerType === 'INDEPENDENT_PRO' && i.to === '/manager/diagnostic' && s.title === '🏠 البداية') return false
        return true
      }),
    }))
    // PRO-F: احذف بنود التخصّص غير المطابقة، وأسقط الأقسام الفارغة.
    if (managerType === 'INDEPENDENT_PRO' && specialty) {
      return [
        ...roleFiltered
          .map((s) => ({
            ...s,
            items: s.items.filter((i) => !i.dept || i.dept === specialty),
          }))
          .filter((s) => s.items.length > 0),
        settingsSection,
      ]
    }
    return [...roleFiltered.filter((s) => s.items.length > 0), settingsSection]
  }
  if (userType === 'INVESTOR') return [...investorNav, settingsSection]
  return []
}

export function homeFor(
  userType: UserType | null | undefined,
  managerType?: ManagerType | null
): string {
  if (userType === 'MANAGER') {
    return managerType === 'INDEPENDENT_PRO'
      ? '/manager/clients'
      : '/manager/dept-dashboard'
  }
  if (userType === 'INVESTOR') return '/investor/dashboard'
  return '/dashboard'
}

export const ACCENT_CLASSES: Record<AccentColor, { dot: string; bgSoft: string; text: string }> = {
  teal:    { dot: 'bg-teal-500',    bgSoft: 'bg-teal-50',    text: 'text-teal-700' },
  indigo:  { dot: 'bg-indigo-500',  bgSoft: 'bg-indigo-50',  text: 'text-indigo-700' },
  amber:   { dot: 'bg-amber-500',   bgSoft: 'bg-amber-50',   text: 'text-amber-700' },
  emerald: { dot: 'bg-emerald-500', bgSoft: 'bg-emerald-50', text: 'text-emerald-700' },
  rose:    { dot: 'bg-rose-500',    bgSoft: 'bg-rose-50',    text: 'text-rose-700' },
  violet:  { dot: 'bg-violet-500',  bgSoft: 'bg-violet-50',  text: 'text-violet-700' },
  sky:     { dot: 'bg-sky-500',     bgSoft: 'bg-sky-50',     text: 'text-sky-700' },
  orange:  { dot: 'bg-orange-500',  bgSoft: 'bg-orange-50',  text: 'text-orange-700' },
}
