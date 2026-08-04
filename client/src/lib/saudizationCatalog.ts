// ─── كتالوج قرارات التوطين (بيانات قابلة للتحديث بلا لمس كود) ──────────────
// منقول من مخطّط «وحدة التوطين الذكية» — تبويب ٣ (دليل القرارات). القرارات
// تتحدّث دورياً من الوزارة؛ لذلك القاعدة: تحديث النِّسب/العتبات/المراحل = تعديل
// هذا الملف فقط. schemaVersion إجباريّ من أول نسخة (قاعدة ٣ للقيم المحفوظة).
// ⚠️ اعتماد المالك مطلوب قبل الاعتماد النهائيّ (docs/SAUDIZATION_GAP.md §5).

export const SAUDIZATION_CATALOG_SCHEMA_VERSION = 1 as const

// تأطير المسؤوليّة (يظهر بجانب أيّ توصية في الشاشة، لا في وثيقة منفصلة):
export const SAUDIZATION_LEGAL_NOTE =
  '⚖️ تقييم ذاتيّ يصف ولا يحكم قانونياً، وليس شهادة امتثال — القرار النظاميّ بالرجوع إلى وزارة الموارد البشرية ومنصّة قوى.'

/** مرحلة زمنيّة لقرار توطين — النسبة المطلوبة وتاريخ سريانها. */
export interface SaudizationPhase {
  ratio: number             // النسبة المطلوبة (٪)
  effectiveFrom?: string    // نصّ التاريخ كما ورد في الدليل (عرض)
  effectiveFromISO?: string // تاريخ ISO للمقارنة الآليّة — تنبيه «المرحلة القادمة» يحتاجه
  labelAr?: string
}

/** قاعدة توطين لفئة مهنيّة واحدة. */
export interface SaudizationRule {
  id: string
  category: string           // الاسم العربيّ للفئة المهنيّة
  restricted?: boolean       // مقصورة ١٠٠٪ للسعوديّين (تسلسل إلزاميّ عند وجود فجوة)
  applyMinWorkers: number    // عتبة عدد العاملين التي عندها ينطبق القرار (٠ = بلا عتبة)
  minSalary?: number         // الحدّ الأدنى لاحتساب السعوديّ (ريال) — حدّ واحد صريح
  minSalaryBachelor?: number // حدّ البكالوريوس (حين يختلف بالدرجة — كالمحاسبة)
  minSalaryDiploma?: number  // حدّ الدبلوم
  minSalaryNote?: string     // بديل نصّيّ حين لا رقم صريح («حسب الدليل»)
  accreditation?: string     // شرط الاعتماد المهنيّ
  phases: SaudizationPhase[] // المراحل مرتّبة زمنيّاً؛ [0] هي السارية حاليّاً
  // حوكمة (إلزاميّة — لا ادّعاء تنظيميّ بلا مصدر وتاريخ تحقّق):
  source: string             // المصدر الرسميّ (قوى / الوزارة …)
  verifiedOn: string         // تاريخ التحقّق ISO — يُوسَم «يحتاج إعادة تحقّق» بعد ٩٠ يوماً
  note?: string
}

// المرحلة السارية حاليّاً = أول عنصر في phases. تحديث المرحلة = إعادة ترتيب/إضافة.
export const SAUDIZATION_CATALOG: SaudizationRule[] = [
  {
    id: 'sales',
    source: 'دليل توطين المهن — قوى',
    verifiedOn: '2026-08-04',
    category: 'مهن المبيعات',
    applyMinWorkers: 3,
    minSalary: 4000, // أساسيّ + بدل سكن
    phases: [{ ratio: 60 }],
  },
  {
    id: 'engineering',
    source: 'دليل توطين المهن — قوى',
    verifiedOn: '2026-08-04',
    category: 'المهن الفنية الهندسية',
    applyMinWorkers: 5,
    minSalary: 5000,
    accreditation: 'اعتماد مهنيّ من الهيئة السعودية للمهندسين',
    phases: [{ ratio: 30, effectiveFrom: '23 يوليو 2025', effectiveFromISO: '2025-07-23' }],
  },
  {
    id: 'admin_support',
    source: 'قائمة المهن المقصورة — وزارة الموارد البشرية',
    verifiedOn: '2026-08-04',
    category: 'المهن الإدارية المساندة (69 مهنة)',
    restricted: true,
    applyMinWorkers: 0, // بلا عتبة عدد — مقصورة للسعوديّين
    phases: [{ ratio: 100 }],
    note: 'للسعوديّين فقط — تسلسل إلزاميّ عند وجود غير سعوديّ (راجع sequenceRequired).',
  },
  {
    id: 'accounting',
    source: 'قرار توطين المهن المحاسبية — قوى',
    verifiedOn: '2026-08-04',
    category: 'المهن المحاسبية (44 مهنة)',
    applyMinWorkers: 5, // وفي المرحلة الأخيرة 3+ بنسبة 30٪ (ملاحظة الدليل)
    // حدّ الاحتساب يختلف بالدرجة؛ عند جهل الدرجة يُؤخذ الأعلى تحفّظاً (بكالوريوس)
    // — الأخذ بالأدنى يُنتج عدّاً متفائلاً زوراً (محاسب براتب ٥٠٠٠ يُحتسب خطأً).
    minSalaryBachelor: 6000,
    minSalaryDiploma: 4500,
    minSalaryNote: '6000 بكالوريوس / 4500 دبلوم',
    accreditation: 'اعتماد الهيئة السعودية للمراجعين والمحاسبين (SOCPA)',
    phases: [
      { ratio: 40, effectiveFrom: '27 أكتوبر 2025', effectiveFromISO: '2025-10-27' },
      { ratio: 50, effectiveFrom: 'أكتوبر 2026', effectiveFromISO: '2026-10-01' },
      { ratio: 70, labelAr: 'الهدف التدريجيّ' },
    ],
  },
  {
    id: 'pharmacy_retail',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'مهن الصيدلة — الصيدليات',
    applyMinWorkers: 5,
    minSalaryNote: 'حسب الدليل',
    accreditation: 'ترخيص الهيئة الصحيّة',
    phases: [{ ratio: 35, effectiveFrom: '23 يوليو 2025', effectiveFromISO: '2025-07-23' }],
  },
  {
    id: 'pharmacy_hospital',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'مهن الصيدلة — المستشفيات',
    applyMinWorkers: 5,
    minSalaryNote: 'حسب الدليل',
    accreditation: 'ترخيص الهيئة الصحيّة',
    phases: [{ ratio: 65, effectiveFrom: '23 يوليو 2025', effectiveFromISO: '2025-07-23' }],
  },
  {
    id: 'pharmacy_other',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'مهن الصيدلة — منشآت أخرى',
    applyMinWorkers: 5,
    minSalaryNote: 'حسب الدليل',
    accreditation: 'ترخيص الهيئة الصحيّة',
    phases: [{ ratio: 55, effectiveFrom: '23 يوليو 2025', effectiveFromISO: '2025-07-23' }],
  },
  {
    id: 'dentistry',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'مهن طب الأسنان',
    applyMinWorkers: 3,
    minSalary: 9000,
    accreditation: 'ترخيص مزاولة',
    phases: [
      { ratio: 45 },
      { ratio: 55, effectiveFrom: 'بعد سنة' },
    ],
  },
  {
    id: 'radiology',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'المهن الصحية — الأشعة',
    applyMinWorkers: 0, // حسب المنشأة الصحيّة (لا عتبة عدد صريحة في الدليل)
    minSalaryNote: 'حسب الدليل',
    accreditation: 'تصنيف الهيئة الصحيّة',
    phases: [{ ratio: 65, effectiveFrom: 'أبريل 2025', effectiveFromISO: '2025-04-01' }],
  },
  {
    id: 'clinical_nutrition',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'المهن الصحية — التغذية العلاجية',
    applyMinWorkers: 0,
    minSalaryNote: 'حسب الدليل',
    accreditation: 'تصنيف الهيئة الصحيّة',
    phases: [{ ratio: 80, effectiveFrom: 'أبريل 2025', effectiveFromISO: '2025-04-01' }],
  },
  {
    id: 'physiotherapy',
    source: 'قرار توطين المهن الصحية — قوى',
    verifiedOn: '2026-08-04',
    category: 'المهن الصحية — العلاج الطبيعي',
    applyMinWorkers: 0,
    minSalaryNote: 'حسب الدليل',
    accreditation: 'تصنيف الهيئة الصحيّة',
    phases: [{ ratio: 80, effectiveFrom: 'أبريل 2025', effectiveFromISO: '2025-04-01' }],
  },
  {
    id: 'procurement',
    source: 'دليل توطين المهن — قوى',
    verifiedOn: '2026-08-04',
    category: 'مهن المشتريات',
    applyMinWorkers: 0, // حسب القرار (رُفعت تدريجيّاً)
    minSalaryNote: 'حسب الدليل',
    phases: [{ ratio: 70 }],
  },
]

/** النسبة السارية حاليّاً لقاعدة (أول مرحلة). */
export function currentRatio(rule: SaudizationRule): number {
  return rule.phases[0]?.ratio ?? 0
}

/** المرحلة القادمة (إن وُجدت) — لتنبيه «القرار دخل مرحلة جديدة» لاحقاً. */
export function nextPhase(rule: SaudizationRule): SaudizationPhase | undefined {
  return rule.phases[1]
}

/**
 * حدّ راتب الاحتساب للقاعدة (ريال) — أو undefined إن كان نصّياً («حسب الدليل»).
 * حين يختلف الحدّ بالدرجة (بكالوريوس/دبلوم) وتُجهَل الدرجة، يُؤخذ **الأعلى تحفّظاً**
 * (البكالوريوس) — الأخذ بالأدنى يُنتج عدّاً متفائلاً زوراً.
 */
export function countingFloor(rule: SaudizationRule): number | undefined {
  if (rule.minSalary != null) return rule.minSalary
  if (rule.minSalaryBachelor != null || rule.minSalaryDiploma != null) {
    return Math.max(rule.minSalaryBachelor ?? 0, rule.minSalaryDiploma ?? 0)
  }
  return undefined
}

// ─── حوكمة: وسم التقادم — صفٌّ تجاوز ٩٠ يوماً منذ تحقّقه «يحتاج إعادة تحقّق» ──
export const STALENESS_DAYS = 90

/** هل تجاوز تاريخ تحقّق القاعدة عتبة التقادم مقارنةً بـ`now`؟ (تاريخ غير صالح = متقادم). */
export function isStale(rule: SaudizationRule, now: Date): boolean {
  const t = Date.parse(rule.verifiedOn)
  if (!isFinite(t)) return true
  return now.getTime() - t > STALENESS_DAYS * 24 * 60 * 60 * 1000
}

// ─── مرجع: مجموعات من الـ69 مهنة المقصورة 100٪ (أمثلة لدليل الفئات) ────────
export const SAUDIZATION_RESTRICTED_GROUPS: { group: string; examples: string }[] = [
  { group: 'الموارد البشرية', examples: 'مدير وأخصائي وخبير موارد بشرية، توظيف واستقطاب وتعويضات وتدريب' },
  { group: 'العلاقات العامة', examples: 'مدير ومستشار وأخصائي علاقات عامة، كاتب علاقات حكومية' },
  { group: 'السكرتارية والدعم', examples: 'سكرتير تنفيذيّ، مساعد إداريّ، مدخل بيانات، أمين صندوق' },
  { group: 'الاستقبال', examples: 'موظف استقبال، كاتب استقبال مرضى، كاتب شكاوى واستعلامات' },
  { group: 'الترجمة واللغات', examples: 'مترجم، مترجم فوريّ، مصحّح لغويّ' },
  { group: 'المخازن واللوجستيات', examples: 'أمين مخزن، كاتب حركة مخزون، كاتب شحن' },
  { group: 'الجمارك', examples: 'مخلّص جمركيّ، وكيل جمركيّ، وكيل شحن' },
  { group: 'الأمن', examples: 'حارس أمن، مراقب كاميرات أمنيّة' },
]
