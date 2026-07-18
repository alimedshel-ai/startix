import { PlaceholderPage } from '@/components/PlaceholderPage'

// ─── Placeholder Routes Registry (SIDEBAR-STRUCTURE.md) ─────────
// كل عنصر «⏳ قريباً» في السايدبار له صفحة شرح موحّدة عبر PlaceholderPage.
// المبدأ: «لا شيء يُدفَن» — الوعد ظاهر، لا 404، لا رمادي.

interface PlaceholderDef {
  path: string
  title: string
  reason: string
  icon: string
  backTo?: string
  relatedLinks?: { to: string; label: string }[]
  // نطاق الدور — لتنظيم الإدراج تحت الـRoleRoute الصحيح.
  scope: 'owner' | 'manager' | 'investor' | 'shared'
}

const PLACEHOLDERS: PlaceholderDef[] = [
  // ملاحظة: /search أُزيل — لوحة ⌘K مبنيّة فعلاً (CommandPalette، مثبّتة في
  // MainLayout وتُفتح بزرّ السايدبار). لم يعد عنصراً مخطّطاً.

  // ─── المالك ─────────────────────────────────────────────────
  {
    path: '/owner/strategic-plan',
    title: '📖 الخطة الاستراتيجيّة للشركة',
    reason: 'محرّك توصية للمالك يقرأ صحّة الشركة العامّة (كل الإدارات) ويوصي بمسار استراتيجي شامل. مختلفٌ عن خطة المدير المستقل التي تعمل على إدارة واحدة.',
    icon: '📖',
    backTo: '/dashboard',
    relatedLinks: [
      { to: '/company-health', label: 'صحّة الشركة' },
      { to: '/directions', label: 'الاتجاهات' },
      { to: '/choices', label: 'القرار الاستراتيجي' },
    ],
    scope: 'owner',
  },

  // ─── المستثمر ───────────────────────────────────────────────
  {
    path: '/investor/activity',
    title: '📰 سجل نشاط المستثمر',
    reason: 'خطّ زمني للأحداث المهمّة في محفظتك: صفقات جديدة، تحديثات شركات، تنبيهات مخاطر.',
    icon: '📰',
    backTo: '/investor/dashboard',
    scope: 'investor',
  },
  {
    path: '/investor/alerts',
    title: '🔔 تنبيهات المستثمر',
    reason: 'إشعارات ذكيّة عن تراجع صحّة الشركات، فرص خروج، تغيّرات القطاع.',
    icon: '🔔',
    backTo: '/investor/dashboard',
    scope: 'investor',
  },
  {
    path: '/investor/sector-preferences',
    title: '🏷️ تفضيلات القطاع',
    reason: 'اضبط القطاعات والمعايير التي يستخدمها فرز الصفقات لعرض ما يناسبك أوّلاً.',
    icon: '🏷️',
    backTo: '/investor/diagnostic',
    scope: 'investor',
  },
  {
    path: '/investor/portfolio/compare',
    title: '⚖️ مقارنة شركات المحفظة',
    reason: 'جدول موحّد يقارن شركاتك جنباً إلى جنب في KPIs، الصحّة، النموّ، والمخاطر.',
    icon: '⚖️',
    backTo: '/investor/portfolio',
    scope: 'investor',
  },
  {
    path: '/investor/portfolio/sectors',
    title: '📊 التوزيع القطاعي',
    reason: 'خارطة توزيع محفظتك بالقطاع والحجم والمنطقة لكشف التركّز.',
    icon: '📊',
    backTo: '/investor/portfolio',
    scope: 'investor',
  },
  // ✅ /investor/financial/dupont و /investor/financial/monte-carlo أُزيلا —
  // صارا صفحتين مبنيّتين (InvestorFinancialPage) تعيدان استخدام محرّك
  // التحليل المالي على شركة المحفظة المختارة.
  {
    path: '/investor/financial/roi',
    title: '💰 ROI محسوب',
    reason: 'حساب فوري للعائد على كل استثمار مع مقارنة ضمنيّة بالسوق والقطاع.',
    icon: '💰',
    backTo: '/investor/portfolio',
    scope: 'investor',
  },
  {
    path: '/investor/financial/reports',
    title: '📑 التقارير الماليّة',
    reason: 'قوائم ماليّة موحّدة للشركات المستثمَر فيها (ميزانيّة، دخل، تدفّق نقدي).',
    icon: '📑',
    backTo: '/investor/portfolio',
    scope: 'investor',
  },
  {
    path: '/investor/scoring',
    title: '📊 إطار التقييم (Scoring)',
    reason: 'نظام درجات قابل للتخصيص لتقييم الصفقات على معايير موحّدة.',
    icon: '📊',
    backTo: '/investor/deals',
    scope: 'investor',
  },
  {
    path: '/investor/due-diligence',
    title: '🔎 قوائم العناية الواجبة',
    reason: 'تدفّق due-diligence منظّم بمراحل + checklists لكل صفقة.',
    icon: '🔎',
    backTo: '/investor/deals',
    scope: 'investor',
  },
  {
    path: '/investor/benchmarking',
    title: '🔍 المقارنة المرجعيّة للاستثمار',
    reason: 'قارن الصفقة المرشّحة بمعايير القطاع (متوسّط ROI، هامش، دوران).',
    icon: '🔍',
    backTo: '/investor/deals',
    scope: 'investor',
  },
  {
    path: '/investor/reports',
    title: '📑 تقارير المستثمر',
    reason: 'تقارير دوريّة PDF/Excel جاهزة للمشاركة مع الشركاء.',
    icon: '📑',
    backTo: '/investor/dashboard',
    scope: 'investor',
  },
  {
    path: '/investor/market',
    title: '🌐 استكشاف السوق',
    reason: 'اكتشف فرص جديدة خارج محفظتك الحاليّة — قطاعات ناشئة وشركات صاعدة.',
    icon: '🌐',
    backTo: '/investor/dashboard',
    scope: 'investor',
  },
  // ✅ /investor/ai/recommendations أُزيل — صار صفحة مبنيّة
  // (InvestorRecommendationsPage) تعيد استخدام محرّك الاستدلال (C16).
]

function element(def: PlaceholderDef) {
  return (
    <PlaceholderPage
      title={def.title}
      reason={def.reason}
      icon={def.icon}
      backTo={def.backTo ?? '/'}
      relatedLinks={def.relatedLinks}
    />
  )
}

export const sharedPlaceholderRoutes = PLACEHOLDERS
  .filter((p) => p.scope === 'shared')
  .map((def) => ({ path: def.path, element: element(def) }))

export const ownerPlaceholderRoutes = PLACEHOLDERS
  .filter((p) => p.scope === 'owner')
  .map((def) => ({ path: def.path, element: element(def) }))

export const managerPlaceholderRoutes = PLACEHOLDERS
  .filter((p) => p.scope === 'manager')
  .map((def) => ({ path: def.path, element: element(def) }))

export const investorPlaceholderRoutes = PLACEHOLDERS
  .filter((p) => p.scope === 'investor')
  .map((def) => ({ path: def.path, element: element(def) }))
