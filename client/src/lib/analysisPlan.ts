// ─── خطّة التحليل المُكيَّفة (①) — تشغيلي / تكتيكي / استراتيجي ────────
// دالّة نقيّة قابلة للاختبار: تأخذ سياق الشركة (حجم × قطاع × نشاط × صحّة)
// وتُرتّب أدوات مرحلة التحليل حسب العمق المناسب. الفلسفة (بقرار المستخدم):
//   • المحرّك = مزيج: الحجم أساس، الصحّة تُعدّل (±)، القطاع يرفع/يعمّق.
//   • الأدوات الثقيلة (بورتر/DNA) مخفيّة افتراضيّاً للمستوى التشغيلي.
// لا غلاف هنا — الصفحة (AnalysisWizardPage) تستهلك المخرجات فقط.
//
// 🔗 حدود الملكيّة (لا اشتقاق ثالث): عمق أدوات التحليل ① (أيّ الأدوات تظهر
// وبأيّ ترتيب) يُشتقّ من analysisPlanFor فقط؛ مسار الرحلة ومستوى العميل من
// classify فقط. لا تشتقّ مساراً من العمق ولا العكس.

export type AnalysisTier = 'operational' | 'tactical' | 'strategic'
export type CompanySize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
export type DangerZone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

export interface AnalysisPlanInput {
  size: CompanySize
  sector?: string | null // كود القطاع (technology/manufacturing/…)
  serviceType?: string | null // نشاط حرّ النصّ (تكميليّ)
  healthPct?: number | null
  dangerZone?: DangerZone | null
}

export interface AnalysisPlan {
  tier: AnalysisTier
  tierLabel: string
  tierIcon: string
  /** جملة تشرح لماذا هذا المستوى (حجم × قطاع × صحّة) — لا طاعة عمياء. */
  why: string
  /** مفاتيح الأدوات الموصى بها بالترتيب (تظهر افتراضيّاً). */
  recommended: string[]
  /** مفاتيح الأدوات المتقدّمة (مخفيّة افتراضيّاً لهذا المستوى). */
  advanced: string[]
}

// ─── الترتيب المرجعيّ: داخل → خارج (يطابق منهجيّة السايد بار) ─────────
// كل أداة + أدنى مستوى تظهر فيه ضمن «الموصى به».
const TOOL_MIN_TIER: Record<string, 0 | 1 | 2> = {
  audit: 0, // تدقيق التخصّص — الأساس، دائماً
  s7: 0, // البيئة الداخليّة 7S
  pestel: 0, // PESTEL — مسح خارجيّ (يملأ فرص/تهديدات SWOT)
  deep: 1, // التحليل العميق (٦٠+ سؤالاً — ثقيل على الصغيرة)
  'value-chain': 1, // سلسلة القيمة
  benchmarking: 1, // المقارنة المرجعيّة
  stakeholders: 1, // أصحاب المصلحة
  porter: 2, // قوى بورتر الخمس (استراتيجيّ)
  'org-dna': 2, // DNA المنظّمة (استراتيجيّ)
}

// التسلسل: تدقيق (نظرة عامّة) → عميق (يجمع السياق) → 7S (يُركّب الصورة
// الداخليّة على أساس العميق) → سلسلة القيمة → DNA → [الخارج] PESTEL → …
// ملاحظة: العميق قبل 7S عمداً — البيئة الداخليّة تُبنى على تحليل أعمق سابق.
// مُصدَّر (الرقعة A ملحق): حارس ترتيب بطاقات ① في صفحة العميل يطابقه ضدّ
// analysisCardOrder — فأيّ انحراف صامت في العرض يصير اختباراً أحمر.
export const BASE_ORDER = [
  'audit', 'deep', 's7', 'value-chain', 'org-dna',
  'pestel', 'porter', 'benchmarking', 'stakeholders',
]

// قطاعات كثيفة الأصول/التنظيم → تستحق عمقاً استراتيجيّاً أعلى (+١ للمستوى).
const COMPLEX_SECTORS = new Set([
  'manufacturing', 'logistics', 'energy', 'realestate', 'healthcare', 'financial',
])

// القطاع يرفع أداةً واحدة حرجة له للأعلى (وإن كانت متقدّمة يُرقّيها للموصى به).
const SECTOR_BOOST: Record<string, string> = {
  manufacturing: 'value-chain',
  logistics: 'value-chain',
  agriculture: 'value-chain',
  retail: 'value-chain',
  energy: 'value-chain',
  consulting: 'stakeholders',
  technology: 'benchmarking',
  education: 'stakeholders',
  healthcare: 'stakeholders',
  financial: 'stakeholders',
  realestate: 'stakeholders',
  hospitality: 'benchmarking',
}

const SIZE_SCORE: Record<CompanySize, 0 | 1 | 2> = {
  MICRO: 0, SMALL: 0, MEDIUM: 1, LARGE: 2,
}

const SIZE_LABEL: Record<CompanySize, string> = {
  MICRO: 'متناهية الصغر', SMALL: 'صغيرة', MEDIUM: 'متوسطة', LARGE: 'كبيرة',
}

// تسمية عرض فقط (المرحلة أ — فكّ تصادم «تشغيلي/تكتيكي» مع مسار الرحلة):
// عمق التحليل = مختصر/موسّع/شامل (لا يشترك حرفاً مع قصير/متوسط/طويل للرحلة).
// القيم الداخليّة operational/tactical/strategic **لا تُمسّ** — صفر ترحيل/كسر منطق.
const TIER_META: Record<AnalysisTier, { label: string; icon: string }> = {
  operational: { label: 'مختصر', icon: '🔧' },
  tactical: { label: 'موسّع', icon: '♟️' },
  strategic: { label: 'شامل', icon: '♜' },
}

// ─── بيانات وصفيّة لكل أداة تحليل (للبوصلة الموجّهة — تسلسل ①) ─────────
export interface AnalysisToolMeta {
  label: string
  icon: string
  /** وجهة الأداة للمدير المستقل (بلا ?client). فارغة للتدقيق (يُحلّ عبر auditRouteFor). */
  path: string
  /** أنواع artifacts التي تدلّ على الاكتمال (أيّ واحد يكفي). */
  artifactBases: string[]
  /** التدقيق يُكتشف عبر hasDeptAudit لا artifact (يُخزَّن في جدول القسم). */
  viaAudit?: boolean
}

export const ANALYSIS_TOOLS: Record<string, AnalysisToolMeta> = {
  audit: { label: 'تدقيق التخصّص', icon: '👤', path: '', artifactBases: [], viaAudit: true },
  // MATURITY يُكمِل 'deep' لتخصّصات النضج (HR/FINANCE): صفحة deep-analysis
  // تعرض تقييم النضج الذي «يحلّ محلّ التحليل العميق» ويحفظ artifact 'MATURITY'
  // لا 'DEPT_DEEP_FULL' — فبدونه يبقى «التالي» عالقاً على العميق رغم إكماله.
  deep: { label: 'التحليل العميق', icon: '🔬', path: '/manager/deep-analysis', artifactBases: ['DEPT_DEEP_FULL', 'DEPT_DEEP_ANSWERS', 'MATURITY'] },
  s7: { label: 'البيئة الداخليّة 7S', icon: '🎯', path: '/internal-environment', artifactBases: ['INTERNAL_ENV'] },
  'value-chain': { label: 'سلسلة القيمة', icon: '🔗', path: '/value-chain', artifactBases: ['VALUE_CHAIN'] },
  'org-dna': { label: 'DNA المنظّمة', icon: '🧬', path: '/org-dna', artifactBases: ['ORG_DNA'] },
  pestel: { label: 'PESTEL للإدارة', icon: '🌐', path: '/manager/dept-pestel', artifactBases: ['PESTEL'] },
  porter: { label: 'قوى بورتر الخمس', icon: '⚔️', path: '/porter', artifactBases: ['PORTER'] },
  benchmarking: { label: 'المقارنة المرجعيّة', icon: '🔍', path: '/benchmarking', artifactBases: ['BENCHMARK'] },
  stakeholders: { label: 'أصحاب المصلحة', icon: '👥', path: '/stakeholders', artifactBases: ['STAKEHOLDERS'] },
}

/** أوّل أداة موصى بها لم تكتمل بعد (بالترتيب) — أو null إن اكتمل التحليل. */
export function firstIncompleteAnalysisKey(
  recommended: string[],
  isDone: (key: string) => boolean,
): string | null {
  return recommended.find((k) => !isDone(k)) ?? null
}

function clamp02(n: number): 0 | 1 | 2 {
  return (n < 0 ? 0 : n > 2 ? 2 : n) as 0 | 1 | 2
}

function isEmergency(health?: number | null, zone?: DangerZone | null): boolean {
  return zone === 'RED' || (health != null && health < 40)
}

function isExcellence(health?: number | null): boolean {
  return health != null && health >= 80
}

// ─── الدالّة الرئيسة ─────────────────────────────────────────────────
export function analysisPlanFor(input: AnalysisPlanInput): AnalysisPlan {
  const { size, sector, healthPct, dangerZone } = input
  const sectorKey = (sector ?? '').toLowerCase()

  // ١) نقاط المستوى = حجم + تعديل الصحّة (±) + عمق القطاع.
  const sizeScore = SIZE_SCORE[size] ?? 0
  const healthDelta = isEmergency(healthPct, dangerZone) ? -1 : isExcellence(healthPct) ? 1 : 0
  const sectorDelta = COMPLEX_SECTORS.has(sectorKey) ? 1 : 0
  const score = clamp02(sizeScore + healthDelta + sectorDelta)
  const tier: AnalysisTier = score === 0 ? 'operational' : score === 1 ? 'tactical' : 'strategic'

  // ٢) قسّم الأدوات: موصى به (≤ المستوى) مقابل متقدّم (> المستوى).
  const recommended = BASE_ORDER.filter((k) => TOOL_MIN_TIER[k] <= score)
  const advanced = BASE_ORDER.filter((k) => TOOL_MIN_TIER[k] > score)

  // ٣) رفع القطاع: إن كانت أداة القطاع الحرجة مخفيّة (متقدّمة)، نُرقّيها
  //    للموصى به لتظهر — لكن في **موضعها الطبيعيّ** من التسلسل المرجعيّ،
  //    لا نقفز بها للأمام. (أصحاب المصلحة أداة سياق خارجيّة → تبقى متأخّرة؛
  //    تقديمها كان يكسر تسلسل داخل→خارج المنطقيّ.)
  const boost = SECTOR_BOOST[sectorKey]
  if (boost) {
    const advIdx = advanced.indexOf(boost)
    if (advIdx !== -1) {
      advanced.splice(advIdx, 1)
      recommended.push(boost)
      recommended.sort((a, b) => BASE_ORDER.indexOf(a) - BASE_ORDER.indexOf(b))
    }
  }

  // ٤) «لماذا» — واعٍ بالإشارات الثلاث.
  const parts: string[] = [`الشركة ${SIZE_LABEL[size] ?? 'غير محدّدة الحجم'}`]
  if (sectorDelta) parts.push('وقطاعها كثيف الأصول/التنظيم يستحقّ عمقاً أعلى')
  if (healthDelta < 0) parts.push(`وصحّتها ${healthPct != null ? Math.round(healthPct) + '٪ ' : ''}حرجة — نضغط التحليل للتحرّك السريع`)
  else if (healthDelta > 0) parts.push('وصحّتها ممتازة — تحتمل تحليلاً أعمق')
  const why = `مستوى ${TIER_META[tier].label}: ${parts.join('، ')}.`

  return { tier, tierLabel: TIER_META[tier].label, tierIcon: TIER_META[tier].icon, why, recommended, advanced }
}
