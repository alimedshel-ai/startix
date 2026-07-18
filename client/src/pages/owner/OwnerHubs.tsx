import { type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Hub, type HubTab } from '@/components/Hub'

// ─── OWNER Hubs — تنفيذ SIDEBAR-STRUCTURE.md بمكوّن Hub الموحّد ────
// ٤ Hub Pages، كل واحدة صفحة واحدة بتبويبات إلزاميّة داخليّة.
// كل تبويب = مجموعة أدوات مترابطة تُعرض كـlauncher (بطاقات إطلاق)،
// لا تُدمَج الأدوات داخل التبويب — لأنها موجودة أصلاً كصفحات كاملة.

interface ToolLink {
  to: string
  icon: string
  title: string
  description: string
  accent?: string
}

// شبكة إطلاق موحّدة — تُستخدم داخل كل تبويب Hub.
function ToolLauncher({ tools, intro }: { tools: ToolLink[]; intro?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {intro}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`group flex flex-col gap-2 rounded-xl border-2 bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
              t.accent ?? 'border-primary/20 hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-bold group-hover:text-primary">{t.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p>
            <span className="mt-auto text-xs font-medium text-primary group-hover:underline">
              افتح الأداة ←
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// بطاقة intro خفيفة قابلة للإعادة الاستخدام لكل تبويب.
function TabIntro({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2 text-xs leading-relaxed text-muted-foreground">
      💡 {text}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🎯 Hub التشخيص — ٣ تبويبات
// ═══════════════════════════════════════════════════════════════
export function OwnerDiagnosticHubPage() {
  const tabs: HubTab[] = [
    {
      key: 'diagnostic',
      icon: '🎯',
      label: 'تشخيص المالك',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="١٥ سؤالاً موزّعة على ٤ محاور (حوكمة · مالي · فريق · رقمنة) — تُخرج درجة صحّة إجماليّة ونتيجة تشخيصيّة." />}
          tools={[
            { icon: '🎯', title: 'ابدأ التشخيص', to: '/diagnostic/owner', description: 'استبيان الشركة الكامل — يستغرق ١٠-١٥ دقيقة.' },
            { icon: '📊', title: 'نتيجة آخر تشخيص', to: '/diagnostic/result', description: 'راجع صحّة الشركة الحاليّة + المسار الاستراتيجي المُوصى.' },
          ]}
        />
      ),
    },
    {
      key: 'assessment',
      icon: '🧭',
      label: 'معالج التقييم',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="أداة تقييم موسّعة أعمق من التشخيص السريع — تناسب المؤسّسات الكبيرة." />}
          tools={[
            { icon: '🧭', title: 'افتح معالج التقييم', to: '/assessment-wizard', description: 'تقييم متعدّد المحاور بعمق تفصيلي.' },
          ]}
        />
      ),
    },
    {
      key: 'health',
      icon: '❤️',
      label: 'صحّة الشركة',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="لوحة صحّة حيّة — تعرض الوضع الحالي مقارنة بمتوسّط الصناعة." />}
          tools={[
            { icon: '❤️', title: 'افتح لوحة الصحّة', to: '/company-health', description: 'مؤشّرات صحّة حيّة + مقارنة مرجعيّة.' },
          ]}
        />
      ),
    },
  ]
  return (
    <Hub
      title="🎯 التشخيص"
      description="ثلاث أدوات تُقدّم صورة كاملة عن صحّة شركتك: التشخيص السريع + معالج التقييم + صحّة الشركة."
      tabs={tabs}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// 🌐 Hub التحليل والتوليف — ٣ تبويبات
// ═══════════════════════════════════════════════════════════════
export function OwnerAnalysisHubPage() {
  const tabs: HubTab[] = [
    {
      key: 'environment',
      icon: '🌐',
      label: 'البيئة والتحليل',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="٧ أدوات لتحليل البيئة الداخليّة والخارجيّة — ابدأ بـ 7S إن كنت جديداً." />}
          tools={[
            { icon: '🎯', title: 'البيئة الداخليّة (7S)',   to: '/internal-environment', description: '٧ عناصر داخليّة (Strategy/Structure/Systems/Style/Staff/Skills/Shared-Values).', accent: 'border-sky-300' },
            { icon: '🌐', title: 'PESTEL',                to: '/pestel',               description: '٦ عوامل خارجيّة (سياسي/اقتصادي/اجتماعي/تقني/بيئي/قانوني).', accent: 'border-emerald-300' },
            { icon: '⚔️', title: 'قوى بورتر الخمس',        to: '/porter',               description: 'قوّة الموردين + العملاء + البدائل + الدخول + المنافسة.', accent: 'border-rose-300' },
            { icon: '🔗', title: 'سلسلة القيمة',           to: '/value-chain',          description: 'الأنشطة الأساسيّة + المساندة + نضج كل نشاط.', accent: 'border-amber-300' },
            { icon: '💎', title: 'القدرات الجوهريّة',      to: '/core-capabilities',    description: 'ما نتقنه فعلاً وما يجعلنا فريدين.', accent: 'border-violet-300' },
            { icon: '🔍', title: 'المقارنة المرجعيّة',    to: '/benchmarking',         description: 'قارن أداءك بمعايير الصناعة.', accent: 'border-indigo-300' },
            { icon: '👥', title: 'أصحاب المصلحة',         to: '/stakeholders',         description: 'من يتأثّر ومن يُؤثّر — تصنيف بالسلطة والاهتمام.', accent: 'border-teal-300' },
          ]}
        />
      ),
    },
    {
      key: 'synthesis',
      icon: '🧭',
      label: 'التوليف',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="بعد التحليل، ادمج المخرجات في SWOT ثم حوّلها إلى استراتيجيّات عبر TOWS." />}
          tools={[
            { icon: '🧭', title: 'SWOT',                  to: '/swot',                 description: '٤ محاور: قوّة/ضعف/فرص/تهديدات — مع توليد تلقائي من التحليل.', accent: 'border-emerald-300' },
            { icon: '🔄', title: 'TOWS',                  to: '/tows',                 description: 'حوّل SWOT إلى ٤ استراتيجيّات (SO · WO · ST · WT).', accent: 'border-sky-300' },
          ]}
        />
      ),
    },
    {
      key: 'risks-gaps',
      icon: '⚠️',
      label: 'المخاطر والفجوات',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="ما الذي يمكن أن يُعرقل التنفيذ؟ ولّد الأولويّات بترتيب المخاطر والفجوات." />}
          tools={[
            { icon: '⚠️', title: 'خريطة المخاطر',         to: '/risk-map',            description: 'شبكة احتماليّة × أثر لكل خطر مع إجراءات التخفيف.', accent: 'border-rose-300' },
            { icon: '🎯', title: 'فجوة الطموح',           to: '/ambition-gap',        description: 'الفارق بين ما ترغب فيه وما تحقّقه فعلاً.', accent: 'border-amber-300' },
            { icon: '⚖️', title: 'التوترات الاستراتيجيّة', to: '/strategic-tensions',   description: 'التوازنات الصعبة (نموّ vs ربحيّة، سرعة vs جودة).', accent: 'border-violet-300' },
          ]}
        />
      ),
    },
  ]
  return (
    <Hub
      title="🌐 التحليل والتوليف"
      description="١٢ أداة موزّعة على ٣ تبويبات: تحليل البيئة → التوليف → المخاطر والفجوات."
      tabs={tabs}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// 🧭 Hub القرار والتوجّه — ٣ تبويبات
// ═══════════════════════════════════════════════════════════════
export function OwnerDecisionHubPage() {
  const tabs: HubTab[] = [
    {
      key: 'directions',
      icon: '🎯',
      label: 'التوجّه والخيارات',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="اقترح ٣-٥ اتجاهات ثم اختر الأفضل بمعايير موزونة." />}
          tools={[
            { icon: '🧭', title: 'الاتجاهات',              to: '/directions', description: 'اقترح اتجاهات استراتيجيّة مُصنّفة (نموّ · دفاع · ابتكار · إلخ).', accent: 'border-sky-300' },
            { icon: '✅', title: 'القرار الاستراتيجي',    to: '/choices',    description: 'اختر الاتجاه الأفضل مع مبرّرات موزونة.', accent: 'border-emerald-300' },
            { icon: '🧮', title: 'QSPM',                  to: '/qspm',       description: 'مصفوفة اختيار كمّي — تقييم بدائل رقمياً.', accent: 'border-violet-300' },
            { icon: '🛰️', title: 'SPACE',                to: '/space',      description: 'موقع استراتيجي على ٤ أبعاد (مالي · بيئي · تنافسي · صناعي).', accent: 'border-amber-300' },
          ]}
        />
      ),
    },
    {
      key: 'business-models',
      icon: '🧩',
      label: 'نماذج الأعمال',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="أدوات تصميم أو إعادة تصميم كيف يعمل عملك ويولّد القيمة." />}
          tools={[
            { icon: '🧩', title: 'Business Model Canvas',  to: '/bmc',    description: '٩ لبنات نموذج الأعمال — من قطاعات العملاء إلى هيكل التكلفة.', accent: 'border-emerald-300' },
            { icon: '📈', title: 'مصفوفة أنسوف',           to: '/ansoff', description: 'خدمة × جمهور: أين تنمو (اختراق/تطوير منتج/تطوير سوق/تنويع).', accent: 'border-sky-300' },
            { icon: '⭐', title: 'مصفوفة BCG',             to: '/bcg',    description: 'محفظة المنتجات: نجم · بقرة حلوب · علامة استفهام · كلب.', accent: 'border-amber-300' },
          ]}
        />
      ),
    },
    {
      key: 'future-gaps',
      icon: '🔭',
      label: 'المستقبل والفجوات',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="خطّط للمستقبل بأفقٍ زمني وسيناريوهات متعدّدة." />}
          tools={[
            { icon: '🔭', title: 'الآفاق الثلاثة',         to: '/three-horizons', description: 'وزّع مبادراتك: نمو اليوم + نمو الغد + رهانات المستقبل.', accent: 'border-violet-300' },
            { icon: '🔮', title: 'السيناريوهات',           to: '/scenarios',      description: 'استكشف مسارات مستقبل بديلة (متفائل/متوسّط/متشائم).', accent: 'border-indigo-300' },
            { icon: '📐', title: 'تحليل الفجوة',           to: '/gap-analysis',   description: 'الفارق بين الوضع الحالي والمستهدَف — ما نحتاج لإغلاقه.', accent: 'border-amber-300' },
          ]}
        />
      ),
    },
  ]
  return (
    <Hub
      title="🧭 القرار والتوجّه"
      description="١٠ أدوات لصناعة القرار: التوجّه → نماذج الأعمال → المستقبل والفجوات."
      tabs={tabs}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// 📊 Hub القياس والتنفيذ — ٣ تبويبات
// ═══════════════════════════════════════════════════════════════
export function OwnerMeasureExecuteHubPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `?client=${client}` : ''
  const tabs: HubTab[] = [
    {
      key: 'objectives-kpis',
      icon: '📊',
      label: 'الأهداف والمؤشّرات',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="من الأهداف الاستراتيجيّة إلى المؤشّرات القابلة للقياس — كلها متّصلة." />}
          tools={[
            { icon: '🎯', title: 'الأهداف الاستراتيجيّة',  to: `/objectives${qs}`,   description: 'أهداف SMART مع توليد ذكي من الخطة الاستراتيجيّة.', accent: 'border-emerald-300' },
            { icon: '🏆', title: 'OKRs',                  to: `/okrs${qs}`,         description: 'نتائج رئيسيّة قابلة للقياس — ٣-٥ لكل هدف.', accent: 'border-sky-300' },
            { icon: '🧩', title: 'إطار OGSM',              to: `/ogsm${qs}`,         description: 'إطار Objectives/Goals/Strategies/Measures — توليد ذكي.', accent: 'border-violet-300' },
            { icon: '📊', title: 'مؤشّرات الأداء (KPIs)',   to: `/kpis${qs}`,         description: 'مؤشّرات مع منحنى متوقّع (S-Curve) + بنك مقترحات.', accent: 'border-amber-300' },
            { icon: '⚖️', title: 'Balanced Scorecard',    to: `/bsc${qs}`,          description: '٤ أبعاد متوازنة — توليد تلقائي من الأهداف والمؤشّرات.', accent: 'border-rose-300' },
            { icon: '✍️', title: 'إدخالات المؤشّرات',      to: `/kpi-entries${qs}`,   description: 'سجّل قيم KPIs الدوريّة مع رسم متوقّع vs واقع.', accent: 'border-indigo-300' },
          ]}
        />
      ),
    },
    {
      key: 'initiatives-priority',
      icon: '💡',
      label: 'المبادرات والأولويّات',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="ماذا نُنفّذ وبأي ترتيب — ٤ أدوات لتحديد الأولويّة والمسؤوليّة." />}
          tools={[
            { icon: '💡', title: 'المبادرات',              to: `/initiatives${qs}`,      description: 'حوّل تحليلاتك إلى مبادرات مرتّبة بالأولويّة.', accent: 'border-emerald-300' },
            { icon: '⚡', title: 'مصفوفة الأولويّة',       to: `/priority-matrix${qs}`,  description: 'أثر × جهد — أين نُنفق طاقتنا أوّلاً.', accent: 'border-sky-300' },
            { icon: '📊', title: 'مصفوفة أيزنهاور',        to: `/eisenhower${qs}`,       description: 'مهم × عاجل — فرز المهام إلى ٤ أرباع.', accent: 'border-amber-300' },
            { icon: '👥', title: 'مصفوفة RACI',            to: `/raci${qs}`,             description: 'من مسؤول؟ Responsible/Accountable/Consulted/Informed.', accent: 'border-violet-300' },
          ]}
        />
      ),
    },
    {
      key: 'execution',
      icon: '🚀',
      label: 'خطوات التنفيذ',
      render: () => (
        <ToolLauncher
          intro={<TabIntro text="من المبادرات إلى خطوات تنفيذ بتواريخ ومهام — التنفيذ الفعلي." />}
          tools={[
            { icon: '📁', title: 'متابعة المبادرات',        to: `/projects${qs}`,     description: 'حوّل كل مبادرة إلى ٢-٤ خطوات تنفيذ بتواريخ وأولويّات وخطورة.', accent: 'border-emerald-300' },
            { icon: '🗓️', title: 'الخطة السنويّة',         to: `/annual-plan${qs}`,  description: 'تجميع سنوي مقسّم إلى ٤ أرباع — للمراجعات الدوريّة.', accent: 'border-sky-300' },
            { icon: '📅', title: 'مخطّط جانت',             to: `/gantt-chart${qs}`,  description: 'خطّ زمني مرئي لخطوات التنفيذ مع تبعياتها.', accent: 'border-amber-300' },
            { icon: '✓',  title: 'المهام',                to: `/tasks${qs}`,        description: 'كل المهام عبر خطوات التنفيذ — تصفية بالحالة والأولويّة.', accent: 'border-violet-300' },
          ]}
        />
      ),
    },
  ]
  return (
    <Hub
      title="📊 القياس والتنفيذ"
      description="١٤ أداة موزّعة على ٣ تبويبات: الأهداف والمؤشّرات → المبادرات والأولويّات → خطط التنفيذ."
      tabs={tabs}
    />
  )
}
