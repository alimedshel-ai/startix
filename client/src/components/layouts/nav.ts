import type { DeptCode } from '@/lib/deptApi'
import type { ManagerType, SpecialtyDeptType, UserType } from '@/types/user'

export interface NavItem {
  to: string
  label: string
  icon?: string
  // SEC-2 — يخفي العنصر عن غير المسؤولين. السيرفر أيضاً يحمي المسار
  // بـ requireAdmin؛ هذا فقط لتنظيف التنقّل.
  adminOnly?: boolean
  // PRO-F — يربط العنصر بإدارة معيّنة. للمدير المستقل (INDEPENDENT_PRO)،
  // نُخفي العناصر التي لا تطابق تخصّصه. عناصر بلا `dept` تظهر للجميع
  // (مثلاً "اختيار الإدارة" أو "لوحة الاحترافية").
  dept?: DeptCode
  // M1..M3 — عنصر مخصّص للمدير المستقل (INDEPENDENT_PRO) فقط. يظهر
  // للمالك والمستقل في السايدبار (المسار في الراوتر يفتح للـ OWNER أيضاً)،
  // لكن يُخفى عن المدير الداخلي (INTERNAL) لأنّه أُنشئ لسير عمل المستشار.
  proOnly?: boolean
}

/** Accent color used by the sidebar for the section header / left-bar marker. */
export type AccentColor = 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky' | 'orange'

export interface NavSection {
  title: string
  accent: AccentColor
  items: NavItem[]
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
    items: [
      { to: '/pestel',       label: 'تحليل PESTEL',          icon: '🌐' },
      { to: '/porter',       label: 'قوى بورتر الخمس',       icon: '⚔️' },
      { to: '/benchmarking', label: 'المقارنة المرجعية',     icon: '🔍' },
      { to: '/stakeholders',        label: 'أصحاب المصلحة',         icon: '👥' },
      { to: '/org-dna',             label: 'الحمض التنظيمي',         icon: '🧬' },
      { to: '/value-chain',         label: 'سلسلة القيمة',           icon: '🔗' },
      { to: '/core-capabilities',   label: 'القدرات الجوهرية',       icon: '💎' },
    ],
  },
  {
    title: 'التوليف',
    accent: 'rose',
    items: [
      { to: '/swot',                 label: 'تحليل SWOT',         icon: '🧭' },
      { to: '/tows',                 label: 'مصفوفة TOWS',         icon: '🔄' },
      { to: '/gap-analysis',         label: 'تحليل الفجوة',        icon: '📐' },
      { to: '/risk-map',             label: 'خريطة المخاطر',       icon: '⚠️' },
      { to: '/ambition-gap',         label: 'فجوة الطموح',         icon: '🎯' },
      { to: '/strategic-tensions',   label: 'التوترات الاستراتيجية', icon: '⚖️' },
    ],
  },
  {
    title: 'الاتجاه الاستراتيجي',
    accent: 'amber',
    items: [
      { to: '/directions',      label: 'الاتجاهات',          icon: '🧭' },
      { to: '/scenarios',       label: 'السيناريوهات',       icon: '🔮' },
      { to: '/choices',         label: 'القرار الاستراتيجي', icon: '✅' },
      { to: '/priority-matrix', label: 'مصفوفة الأولوية',    icon: '⚡' },
      { to: '/ansoff',          label: 'مصفوفة أنسوف',       icon: '📐' },
      { to: '/bcg',             label: 'مصفوفة BCG',         icon: '⭐' },
      { to: '/space',           label: 'مصفوفة SPACE',       icon: '🛰️' },
      { to: '/qspm',            label: 'مصفوفة QSPM',        icon: '🧮' },
      { to: '/three-horizons',  label: 'الآفاق الثلاثة',     icon: '🔭' },
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
      { to: '/kpi-entries',  label: 'إدخالات المؤشرات', icon: '✍️' },
      { to: '/initiatives',  label: 'المبادرات',        icon: '💡' },
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

const managerNav: NavSection[] = [
  {
    title: 'التشخيص',
    accent: 'sky',
    items: [{ to: '/manager/diagnostic', label: 'تشخيص المدير', icon: '🎯' }],
  },
  {
    title: 'الإدارة',
    accent: 'teal',
    items: [
      { to: '/manager/select-dept',         label: 'اختيار الإدارة',    icon: '🏢' },
      { to: '/manager/dept-dashboard',      label: 'لوحة الإدارة',       icon: '📊' },
      { to: '/manager/pro-dashboard',       label: 'اللوحة الاحترافية',  icon: '⭐' },
      { to: '/manager/deep-analysis',       label: 'التحليل العميق المخصّص', icon: '🔬' },
      { to: '/manager/dept-deep',           label: 'تحليل مبسّط',         icon: '📝' },
      { to: '/manager/contradictions',      label: 'تحليل التناقضات',       icon: '⚡' },
      { to: '/manager/dept-smart',          label: 'تحليل SMART',         icon: '✨' },
    ],
  },
  {
    title: 'تدقيق الإدارات',
    accent: 'indigo',
    items: [
      { to: '/manager/hr/audit',             label: 'الموارد البشرية',          icon: '👤', dept: 'HR' },
      { to: '/manager/finance/audit',        label: 'المالية',                  icon: '💰', dept: 'FINANCE' },
      { to: '/manager/finance/break-even',   label: 'نقطة التعادل',             icon: '⚖️', dept: 'FINANCE' },
      { to: '/manager/sales/audit',          label: 'المبيعات',                  icon: '💼', dept: 'SALES' },
      { to: '/manager/marketing/audit',      label: 'التسويق',                   icon: '📢', dept: 'MARKETING' },
      { to: '/manager/operations/audit',     label: 'العمليات',                  icon: '⚙️', dept: 'OPERATIONS' },
      { to: '/manager/it/audit',             label: 'تقنية المعلومات',           icon: '💻', dept: 'IT' },
      { to: '/manager/cs/audit',             label: 'خدمة العملاء',              icon: '📞', dept: 'CUSTOMER_SERVICE' },
      { to: '/manager/logistics/audit',      label: 'الإمداد واللوجستيات',       icon: '🚚', dept: 'LOGISTICS' },
      { to: '/manager/logistics/reform',     label: 'خطة إصلاح اللوجستيات',     icon: '🔧', dept: 'LOGISTICS' },
      { to: '/manager/quality/audit',        label: 'الجودة',                    icon: '✅', dept: 'QUALITY' },
      { to: '/manager/projects/audit',       label: 'المشاريع',                  icon: '📋', dept: 'PROJECTS' },
      { to: '/manager/governance/audit',     label: 'الحوكمة',                   icon: '🏛️', dept: 'GOVERNANCE' },
      { to: '/manager/governance/hub',       label: 'مركز الحوكمة',              icon: '⚖️', dept: 'GOVERNANCE' },
    ],
  },
  {
    title: 'التوليف الاستراتيجي',
    accent: 'rose',
    items: [
      // M1 — أدوات التوليف مُتاحة للمدير المستقل عبر ?client=<id>.
      { to: '/swot',            label: 'تحليل SWOT',       icon: '🧭', proOnly: true },
      { to: '/tows',            label: 'مصفوفة TOWS',       icon: '🔄', proOnly: true },
      { to: '/gap-analysis',    label: 'تحليل الفجوة',      icon: '📐', proOnly: true },
      { to: '/risk-map',        label: 'خريطة المخاطر',     icon: '⚠️', proOnly: true },
      { to: '/priority-matrix', label: 'مصفوفة الأولوية',   icon: '⚡', proOnly: true },
    ],
  },
  {
    title: 'التنفيذ',
    accent: 'emerald',
    items: [
      // M2 — أدوات التنفيذ متاحة للمدير المستقل عبر ?client=<id>.
      { to: '/objectives',   label: 'الأهداف',          icon: '🎯', proOnly: true },
      { to: '/okrs',         label: 'OKRs',             icon: '🏆', proOnly: true },
      { to: '/ogsm',         label: 'إطار OGSM',         icon: '🧩', proOnly: true },
      { to: '/kpis',         label: 'مؤشرات الأداء',    icon: '📊', proOnly: true },
      { to: '/kpi-entries',  label: 'إدخالات المؤشرات', icon: '✍️', proOnly: true },
      { to: '/initiatives',  label: 'المبادرات',        icon: '💡', proOnly: true },
      { to: '/projects',     label: 'المشاريع',         icon: '📁', proOnly: true },
      { to: '/annual-plan',  label: 'الخطة السنوية',    icon: '🗓️', proOnly: true },
      { to: '/gantt-chart',  label: 'مخطط جانت',        icon: '📅', proOnly: true },
      { to: '/tasks',        label: 'المهام',           icon: '✓', proOnly: true },
    ],
  },
  {
    title: 'التحليل المالي',
    accent: 'emerald',
    items: [
      // M3 — التحليل المالي متاح للمدير المستقل عبر ?client=<id>.
      { to: '/financial-analysis',        label: 'Dupont و Monte Carlo', icon: '📐', proOnly: true },
      { to: '/manager/finance/break-even', label: 'نقطة التعادل',        icon: '⚖️', dept: 'FINANCE' },
    ],
  },
  {
    title: 'الامتثال',
    accent: 'rose',
    items: [
      { to: '/manager/compliance/audit',     label: 'تدقيق الامتثال — أساسي',   icon: '⚖️', dept: 'COMPLIANCE' },
      { to: '/manager/compliance/audit-pro', label: 'تدقيق الامتثال — احترافي', icon: '🛡️', dept: 'COMPLIANCE' },
      { to: '/manager/compliance/reform',    label: 'خطة الإصلاح',              icon: '🔧', dept: 'COMPLIANCE' },
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
  title: 'العملاء',
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
    // غير إدارته من قوائم "تدقيق الإدارات" و"الامتثال"، ثم أسقط الأقسام
    // اللي بقت فارغة (مثلاً قسم الامتثال إذا كان تخصّصه ليس COMPLIANCE).
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
