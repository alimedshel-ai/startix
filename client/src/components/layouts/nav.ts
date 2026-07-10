import type { DeptCode } from '@/lib/deptApi'
import type { StageId } from '@/lib/journeyStages'
import type { ManagerType, SpecialtyDeptType, UserType } from '@/types/user'

export interface NavItem {
  to: string
  label: string
  icon?: string
  // SEC-2 — يخفي العنصر عن غير المسؤولين. السيرفر أيضاً يحمي المسار
  // بـ requireAdmin؛ هذا فقط لتنظيف التنقّل.
  adminOnly?: boolean
  // PRO-F — يربط العنصر بإدارة معيّنة. للمدير المستقل (INDEPENDENT_PRO)،
  // نُخفي العناصر التي لا تطابق تخصّصه.
  dept?: DeptCode
  // M1..M3 — عنصر مخصّص للمدير المستقل (INDEPENDENT_PRO) فقط. يظهر
  // للمالك والمستقل في السايدبار (المسار في الراوتر يفتح للـ OWNER أيضاً)،
  // لكن يُخفى عن المدير الداخلي (INTERNAL) لأنّه أُنشئ لسير عمل المستشار.
  proOnly?: boolean
  // Sidebar (Commit ٣) — العناصر الأساسية (⭐) للأقسام القابلة للطي.
  // القسم ① يعرض هذه دائماً، والبقية خلف زر «أظهر المزيد».
  essential?: boolean
}

/** Accent color used by the sidebar for the section header / left-bar marker. */
export type AccentColor = 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky' | 'orange'

export interface NavSection {
  title: string
  accent: AccentColor
  items: NavItem[]
  // ربط القسم بمرحلة في التسلسل الاستراتيجي المقفل. Sidebar يستخدمه لعرض
  // شارة حالة (🔒 مقفل / ✓ مكتمل / ● قيد العمل) بجانب عنوان القسم.
  // الأقسام غير المرتبطة بمرحلة (البداية، المالي، الخطة والذكاء) لا يوجد
  // لها stageId فتظهر بدون شارة.
  stageId?: StageId
  // Sidebar (Commit ٣) — لو true: العناصر بلا `essential` تُطوى تحت زر
  // «أظهر ن عنصراً إضافياً». يُستخدم للقسم ① (١٠ عناصر → ٣ ⭐ + ٧ موسّع)
  // لتفادي إرهاق بصري.
  collapsible?: boolean
}

const ownerNav: NavSection[] = [
  {
    title: 'نظرة عامة',
    accent: 'teal',
    items: [
      { to: '/dashboard',           label: 'لوحة القيادة',         icon: '🏠' },
      { to: '/ceo-dashboard',       label: 'لوحة الرئيس التنفيذي',  icon: '👔' },
      { to: '/exec-dashboard',      label: 'لوحة الفريق التنفيذي',  icon: '👥' },
      { to: '/board-dashboard',     label: 'لوحة المجلس',           icon: '🏛️' },
      { to: '/admin-dashboard',     label: 'لوحة المسؤول',          icon: '🛠️', adminOnly: true },
      { to: '/live-board',          label: 'اللوحة الحية',          icon: '⚡' },
      { to: '/analytics-dashboard', label: 'التحليلات',             icon: '📈' },
      { to: '/activity-feed',       label: 'سجل النشاط',            icon: '📰' },
    ],
  },
  {
    title: 'الشركات',
    accent: 'indigo',
    items: [
      { to: '/companies',     label: 'شركاتي',         icon: '🏢' },
      { to: '/companies/add', label: 'إضافة شركة',     icon: '➕' },
      { to: '/invitations',   label: 'دعوات الفريق',   icon: '✉️' },
    ],
  },
  {
    title: 'التشخيص',
    accent: 'sky',
    items: [
      { to: '/diagnostic/owner',  label: 'تشخيص المالك',   icon: '🎯' },
      { to: '/diagnostic/result', label: 'نتيجة التشخيص',  icon: '📊' },
      { to: '/company-health',    label: 'صحة الشركة',     icon: '❤️' },
    ],
  },
  {
    title: 'التحليل الاستراتيجي',
    accent: 'violet',
    // ترتيب مطابق لجدول ٣٤ الأداة (المرحلة ①).
    items: [
      { to: '/internal-environment', label: 'البيئة الداخلية (7S)',   icon: '🎯' },
      { to: '/value-chain',          label: 'سلسلة القيمة',           icon: '🔗' },
      { to: '/porter',               label: 'قوى بورتر الخمس',        icon: '⚔️' },
      { to: '/pestel',               label: 'تحليل PESTEL',           icon: '🌐' },
      { to: '/core-capabilities',    label: 'القدرات الجوهرية',       icon: '💎' },
      { to: '/benchmarking',         label: 'المقارنة المرجعية',      icon: '🔍' },
      { to: '/org-dna',              label: 'الحمض التنظيمي',         icon: '🧬' },
      { to: '/stakeholders',         label: 'أصحاب المصلحة',          icon: '👥' },
    ],
  },
  {
    title: 'المرحلة ② — التوليف',
    accent: 'rose',
    // ⚠️ Gap نُقل إلى ③ (الاتجاه) مطابقاً لجدول المستخدم.
    items: [
      { to: '/swot',                 label: 'تحليل SWOT',         icon: '🧭' },
      { to: '/tows',                 label: 'مصفوفة TOWS',         icon: '🔄' },
      { to: '/risk-map',             label: 'خريطة المخاطر',       icon: '⚠️' },
      { to: '/ambition-gap',         label: 'فجوة الطموح',         icon: '🎯' },
      { to: '/strategic-tensions',   label: 'التوترات الاستراتيجية', icon: '⚖️' },
    ],
  },
  {
    title: 'المرحلة ③ — التوجّهات والخيارات',
    accent: 'amber',
    // ترتيب مطابق لجدول المستخدم (#١٤-٢٠).
    items: [
      { to: '/directions',      label: 'الاتجاهات',              icon: '🧭' },
      { to: '/bmc',             label: 'نموذج الأعمال Canvas',   icon: '🧩' },
      { to: '/gap-analysis',    label: 'تحليل الفجوة',           icon: '📐' },
      { to: '/three-horizons',  label: 'الآفاق الثلاثة',         icon: '🔭' },
      { to: '/choices',         label: 'القرار الاستراتيجي',     icon: '✅' },
      { to: '/bcg',             label: 'مصفوفة BCG',             icon: '⭐' },
      { to: '/ansoff',          label: 'مصفوفة أنسوف',           icon: '📐' },
      { to: '/scenarios',       label: 'السيناريوهات',           icon: '🔮' },
      { to: '/priority-matrix', label: 'مصفوفة الأولوية',        icon: '⚡' },
      { to: '/eisenhower',      label: 'مصفوفة أيزنهاور',        icon: '📊' },
      { to: '/space',           label: 'مصفوفة SPACE',           icon: '🛰️' },
      { to: '/qspm',            label: 'مصفوفة QSPM',            icon: '🧮' },
    ],
  },
  {
    title: 'التنفيذ',
    accent: 'emerald',
    items: [
      { to: '/objectives',   label: 'الأهداف',          icon: '🎯' },
      { to: '/okrs',         label: 'OKRs',             icon: '🏆' },
      { to: '/ogsm',         label: 'إطار OGSM',         icon: '🧩' },
      { to: '/kpis',         label: 'مؤشرات الأداء',    icon: '📊' },
      { to: '/bsc',          label: 'Balanced Scorecard', icon: '⚖️' },
      { to: '/kpi-entries',  label: 'إدخالات المؤشرات', icon: '✍️' },
      { to: '/initiatives',  label: 'المبادرات',        icon: '💡' },
      { to: '/raci',         label: 'مصفوفة RACI',       icon: '👥' },
      { to: '/projects',     label: 'المشاريع',         icon: '📁' },
      { to: '/annual-plan',  label: 'الخطة السنوية',    icon: '🗓️' },
      { to: '/gantt-chart',  label: 'مخطط جانت',        icon: '📅' },
      { to: '/tasks',        label: 'المهام',           icon: '✓' },
    ],
  },
  {
    title: 'المراجعة والتقارير',
    accent: 'orange',
    items: [
      { to: '/strategic-calendar', label: 'التقويم الاستراتيجي', icon: '🗓️' },
      { to: '/reviews',            label: 'المراجعات',           icon: '🔁' },
      { to: '/corrections',        label: 'الإجراءات التصحيحية', icon: '🔧' },
      { to: '/reports',            label: 'التقارير',            icon: '📑' },
    ],
  },
  {
    title: 'التحليل المالي',
    accent: 'emerald',
    items: [
      { to: '/financial-analysis', label: 'Dupont و Monte Carlo', icon: '📐' },
    ],
  },
  {
    title: 'محرك التقييم',
    accent: 'violet',
    items: [
      { to: '/assessment-wizard', label: 'معالج التقييم', icon: '🧭' },
    ],
  },
  {
    title: 'الذكاء الاصطناعي',
    accent: 'violet',
    items: [
      { to: '/ai-center',       label: 'مركز الذكاء',         icon: '🤖' },
      { to: '/ai/advisor',      label: 'المستشار',             icon: '💬' },
      { to: '/ai/presentation', label: 'مولّد العروض',         icon: '🎞️' },
      { to: '/ai/pain-screen',  label: 'فحص نقاط الألم',       icon: '🩺' },
      { to: '/ai/simulation',   label: 'مختبر المحاكاة',       icon: '🧪' },
    ],
  },
]

// ─── سايدبار المدير — ٩ أقسام مرقّمة (المسار الاستراتيجي المقفل) ─
// المدير المستقل يمشي من ① → ⑥. الأقسام غير المرقّمة (البداية،
// المالي، الخطة والذكاء) أدوات مساندة تُستخدم عبر الرحلة.
//
// خارج المرحلة: قسم «العملاء» (proClientsSection) يُضاف تلقائياً فوق
// السايدبار للمدير المستقل عبر `navFor()`.
//
// INTERNAL manager: يرى نفس الأقسام بدون فلترة `proOnly`.
// INDEPENDENT_PRO مع تخصّص: يُطبَّق فلتر `dept === specialty`
// في `navFor()` فيرى فقط تدقيقات/إصلاحات تخصّصه.
const managerNav: NavSection[] = [
  // ─── ٠) البداية ─────────────────────────────────────────────
  {
    title: '🏠 البداية',
    accent: 'teal',
    items: [
      { to: '/manager/dept-dashboard', label: 'لوحة الإدارة',  icon: '📊' },
      { to: '/manager/diagnostic',      label: 'تشخيص المدير', icon: '🎯' },
    ],
  },

  // ─── ① التشخيص وتحليل البيئة ─────────────────────────────
  // ٩ أدوات جوهرية للبيئة الداخلية والخارجية + التدقيق التخصّصي
  // (يظهر تدقيق واحد فقط للمدير المستقل بحسب `dept === specialty`).
  {
    title: '🌐 ① التشخيص وتحليل البيئة',
    accent: 'sky',
    stageId: 'environment',
    collapsible: true,
    items: [
      // ⭐ الأدوات النجمية الأساسية (تظهر دائماً)
      { to: '/internal-environment',  label: 'البيئة الداخلية (7S)',   icon: '🎯', proOnly: true, essential: true },
      { to: '/manager/deep-analysis', label: 'التحليل العميق للإدارة', icon: '🔬', proOnly: true, essential: true },
      { to: '/manager/dept-pestel',   label: 'PESTEL للإدارة',         icon: '🌐', proOnly: true, essential: true },
      // ⭐ تدقيق التخصّص أيضاً أساسي (فلتر dept يُظهر واحداً فقط)
      { to: '/manager/hr/audit',             label: 'تدقيق الموارد البشرية',  icon: '👤', dept: 'HR',                essential: true },
      { to: '/manager/finance/audit',        label: 'تدقيق المالية',          icon: '💰', dept: 'FINANCE',           essential: true },
      { to: '/manager/sales/audit',          label: 'تدقيق المبيعات',         icon: '💼', dept: 'SALES',             essential: true },
      { to: '/manager/marketing/audit',      label: 'تدقيق التسويق',          icon: '📢', dept: 'MARKETING',         essential: true },
      { to: '/manager/operations/audit',     label: 'تدقيق العمليات',         icon: '⚙️', dept: 'OPERATIONS',        essential: true },
      { to: '/manager/it/audit',             label: 'تدقيق تقنية المعلومات',  icon: '💻', dept: 'IT',                essential: true },
      { to: '/manager/cs/audit',             label: 'تدقيق خدمة العملاء',     icon: '📞', dept: 'CUSTOMER_SERVICE',  essential: true },
      { to: '/manager/logistics/audit',      label: 'تدقيق اللوجستيات',       icon: '🚚', dept: 'LOGISTICS',         essential: true },
      { to: '/manager/quality/audit',        label: 'تدقيق الجودة',           icon: '✅', dept: 'QUALITY',           essential: true },
      { to: '/manager/projects/audit',       label: 'تدقيق المشاريع',         icon: '📋', dept: 'PROJECTS',          essential: true },
      { to: '/manager/governance/audit',     label: 'تدقيق الحوكمة',          icon: '🏛️', dept: 'GOVERNANCE',        essential: true },
      { to: '/manager/compliance/audit',     label: 'تدقيق الامتثال',         icon: '⚖️', dept: 'COMPLIANCE',        essential: true },

      // بقية أدوات المرحلة (خلف زر "أظهر المزيد")
      { to: '/value-chain',           label: 'سلسلة القيمة',           icon: '🔗', proOnly: true },
      { to: '/porter',                label: 'قوى بورتر الخمس',        icon: '⚔️', proOnly: true },
      { to: '/core-capabilities',     label: 'القدرات الجوهرية',       icon: '💎', proOnly: true },
      { to: '/benchmarking',          label: 'المقارنة المرجعية',      icon: '🔍', proOnly: true },
      { to: '/org-dna',               label: 'DNA المنظمة',            icon: '🧬', proOnly: true },
      { to: '/stakeholders',          label: 'أصحاب المصلحة',          icon: '👥', proOnly: true },
      // أدوات ثانوية لتخصّصات معيّنة
      { to: '/manager/governance/hub',       label: 'مركز الحوكمة',           icon: '⚖️', dept: 'GOVERNANCE' },
      { to: '/manager/compliance/audit-pro', label: 'تدقيق الامتثال احترافي',  icon: '🛡️', dept: 'COMPLIANCE' },
    ],
  },

  // ─── ② التوليف ─────────────────────────────────────────────
  {
    title: '🧭 ② التوليف',
    accent: 'rose',
    stageId: 'synthesis',
    items: [
      { to: '/swot',                   label: 'تحليل SWOT',     icon: '🧭', proOnly: true },
      { to: '/tows',                   label: 'مصفوفة TOWS',     icon: '🔄', proOnly: true },
      { to: '/manager/contradictions', label: 'تحليل التناقضات', icon: '⚡', proOnly: true },
    ],
  },

  // ─── ③ التوجّه والخيارات ─────────────────────────────────
  // Gap (سواء العام أو dept-scoped) هنا حسب `journeyStages.ts`.
  {
    title: '🎯 ③ التوجّه والخيارات',
    accent: 'amber',
    stageId: 'directions',
    items: [
      { to: '/directions',       label: 'التوجّه الاستراتيجي',   icon: '🎯', proOnly: true },
      { to: '/bmc',              label: 'نموذج الأعمال Canvas', icon: '🧩', proOnly: true },
      { to: '/manager/dept-gap', label: 'فجوات الإدارة',        icon: '📐', proOnly: true },
      { to: '/ansoff',           label: 'مصفوفة أنسوف',          icon: '📈', proOnly: true },
      { to: '/bcg',              label: 'مصفوفة BCG',            icon: '⭐', proOnly: true },
      { to: '/choices',          label: 'القرار الاستراتيجي',   icon: '✅', proOnly: true },
      { to: '/three-horizons',   label: 'الآفاق الثلاثة',        icon: '🔭', proOnly: true },
      { to: '/scenarios',        label: 'السيناريوهات',          icon: '🔮', proOnly: true },
    ],
  },

  // ─── ④ الأهداف والمؤشرات ─────────────────────────────────
  {
    title: '📊 ④ الأهداف والمؤشرات',
    accent: 'emerald',
    stageId: 'indicators',
    items: [
      { to: '/bsc',                label: 'Balanced Scorecard', icon: '⚖️', proOnly: true },
      { to: '/objectives',         label: 'الأهداف الاستراتيجية', icon: '🎯', proOnly: true },
      { to: '/okrs',               label: 'OKRs',                 icon: '🏆', proOnly: true },
      { to: '/ogsm',               label: 'إطار OGSM',            icon: '🧩', proOnly: true },
      { to: '/kpis',               label: 'مؤشرات الأداء',       icon: '📊', proOnly: true },
      { to: '/kpi-entries',        label: 'إدخالات المؤشرات',    icon: '✍️', proOnly: true },
      { to: '/manager/dept-smart', label: 'ذكاء KPIs',            icon: '✨', proOnly: true },
      { to: '/annual-plan',        label: 'الخطة السنوية',       icon: '🗓️', proOnly: true },
    ],
  },

  // ─── ⑤ المبادرات والمخاطر ─────────────────────────────────
  {
    title: '💡 ⑤ المبادرات والمخاطر',
    accent: 'violet',
    stageId: 'initiatives',
    items: [
      { to: '/initiatives',     label: 'المبادرات',         icon: '💡', proOnly: true },
      { to: '/priority-matrix', label: 'مصفوفة الأولوية',    icon: '⚡', proOnly: true },
      { to: '/eisenhower',      label: 'مصفوفة أيزنهاور',    icon: '📊', proOnly: true },
      { to: '/risk-map',        label: 'خريطة المخاطر',      icon: '⚠️', proOnly: true },
      { to: '/raci',            label: 'مصفوفة RACI',        icon: '👥', proOnly: true },
    ],
  },

  // ─── ⑥ التنفيذ والمتابعة ─────────────────────────────────
  {
    title: '🚀 ⑥ التنفيذ والمتابعة',
    accent: 'orange',
    stageId: 'execution',
    items: [
      { to: '/projects',    label: 'المشاريع',   icon: '📁', proOnly: true },
      { to: '/gantt-chart', label: 'مخطط جانت', icon: '📅', proOnly: true },
      { to: '/tasks',       label: 'المهام',    icon: '✓', proOnly: true },
    ],
  },

  // ─── التحليل المالي (مساند لكل المراحل) ─────────────────────
  {
    title: '💰 التحليل المالي',
    accent: 'emerald',
    items: [
      { to: '/financial-analysis',         label: 'Dupont و Monte Carlo', icon: '📐', proOnly: true },
      { to: '/manager/finance/break-even', label: 'نقطة التعادل',         icon: '⚖️', dept: 'FINANCE' },
    ],
  },

  // ─── الخطة والذكاء + خطط إصلاح تخصّصية ─────────────────────
  {
    title: '🗺️ الخطة والذكاء',
    accent: 'violet',
    items: [
      { to: '/manager/strategic-plan', label: 'الخطة الاستراتيجية', icon: '🗺️', proOnly: true },
      { to: '/manager/dept-deep',      label: 'التحليل المبسّط',    icon: '📝' },
      // خطط إصلاح تخصّصية (فلتر `dept` يُظهرها فقط للتخصّصات المعنية).
      { to: '/manager/logistics/reform',  label: 'خطة إصلاح اللوجستيات', icon: '🔧', dept: 'LOGISTICS' },
      { to: '/manager/compliance/reform', label: 'خطة إصلاح الامتثال',   icon: '🔧', dept: 'COMPLIANCE' },
    ],
  },
]

const investorNav: NavSection[] = [
  {
    title: 'التشخيص',
    accent: 'sky',
    items: [{ to: '/investor/diagnostic', label: 'تشخيص المستثمر', icon: '🎯' }],
  },
  {
    title: 'المحفظة',
    accent: 'emerald',
    items: [
      { to: '/investor/dashboard', label: 'لوحة المستثمر', icon: '📊' },
      { to: '/investor/portfolio', label: 'المحفظة',        icon: '💼' },
    ],
  },
  {
    title: 'الصفقات',
    accent: 'amber',
    items: [
      { to: '/investor/deals', label: 'خط الأنابيب', icon: '🤝' },
    ],
  },
]

// PRO-B — قسم مستقل للمدير المستقل (INDEPENDENT_PRO) يعرض قائمة عملائه.
// يُدرج فقط عندما يكون نوع المدير INDEPENDENT_PRO لأنه لا معنى له للـ INTERNAL.
const proClientsSection: NavSection = {
  title: '🤝 العملاء',
  accent: 'amber',
  items: [{ to: '/manager/clients', label: 'عملائي', icon: '🤝' }],
}

export function navFor(
  userType: UserType | null | undefined,
  managerType?: ManagerType | null,
  specialty?: SpecialtyDeptType | null
): NavSection[] {
  if (userType === 'OWNER') return ownerNav
  if (userType === 'MANAGER') {
    const base = managerType === 'INDEPENDENT_PRO'
      ? [proClientsSection, ...managerNav]
      : managerNav
    // PRO-F — للمدير المستقل مع تخصّص محدّد: احذف كل بند مرتبط بإدارة
    // غير إدارته، ثم أسقط الأقسام اللي بقت فارغة.
    if (managerType === 'INDEPENDENT_PRO' && specialty) {
      return base
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => !i.dept || i.dept === specialty),
        }))
        .filter((s) => s.items.length > 0)
    }
    return base
  }
  if (userType === 'INVESTOR') return investorNav
  return []
}

export function homeFor(
  userType: UserType | null | undefined,
  managerType?: ManagerType | null
): string {
  // المدير المستقل يعمل عبر عدّة عملاء — بيته «عملائي» لا لوحة إدارة وحيدة.
  // المدير الداخلي يبقى على لوحة إدارته (شركة واحدة). الأمر ٢٦ في الخطة.
  if (userType === 'MANAGER') {
    return managerType === 'INDEPENDENT_PRO'
      ? '/manager/clients'
      : '/manager/dept-dashboard'
  }
  if (userType === 'INVESTOR') return '/investor/dashboard'
  return '/dashboard'
}

/** Resolves accent color tokens to Tailwind classes. Centralized so sidebar
 *  and any future accent-using component stay in sync. */
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
