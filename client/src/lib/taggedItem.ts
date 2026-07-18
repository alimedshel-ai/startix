// ═══════════════════════════════════════════════════════════════════════
// TaggedItem — النصّ المرجعي للفريق (v1)
//
// Article 1 الحاكم (مُحدَّث):
//   «حقل TaggedItem.text النابع من توليد آلي (origin='auto') لا يحوي أبداً
//    رمزَي ⟪ أو ⟫. أمّا نصّ المستخدم (origin='user:<id>') فمقدّس ويمرّ كما هو
//    حتى لو احتوى ⟪ — الهوية تُحسم بحقل origin المستقل لا بمحتوى النصّ.»
//
// المصدر والسبب يعيشان في حقول منفصلة داخل الـwrapper، والشارة 🤖 تُشتقّ
// من origin وقت الرندرة — لا تُخزَّن في القاعدة.
//
// النطاق (v1): قوائم SWOT · TOWS · Objectives (نصّيّة).
// خارج النطاق: الحقول المفردة الحسابيّة (KPI.currentValue · Objective.status)
//   — تنتظر جدول FieldEditLog في v2.
// ═══════════════════════════════════════════════════════════════════════

// ─── الحماية: رموز محظورة في النصّ الآلي فقط ──────────────────
const FORBIDDEN_MARKERS = /[⟪⟫]/

// ─── النوع الجوهري ───────────────────────────────────────────
/**
 * أصل البند. البيئة تشاركيّة → البند اليدوي يحمل معرّف صاحبه `user:<id>`
 * (لا boolean، ولا 'user' مجرّدة) لتفادي الهجرة وفقد نسبة الملكيّة لاحقاً.
 */
export type Origin = 'auto' | `user:${string}`

export interface TaggedItem {
  /** مُعرّف فريد ومستمرّ — حجر أساس حارس الهوية الثابت (Identity Invariant). */
  id: string
  /** نصّ يراه المستخدم. الآلي نظيف من ⟪⟫ (Article 1)؛ اليدوي حرّ كما كتبه. */
  text: string
  /** 'auto' = مُولَّد آلياً · `user:<id>` = مضاف يدوياً (لا يُمسح أبداً). */
  origin: Origin
  /** مصدر التوليد إن كان آلياً: 'PESTEL' · 'التحليل العميق' · 'الفجوة' · ... */
  source?: string
  /** شرح بشري قصير لسبب التصنيف. */
  reason?: string
  /** ISO 8601 لوقت التوليد الآلي. */
  ts?: string
}

// ─── مُعرّف فريد ────────────────────────────────────────────
function genId(prefix = 'item'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11)
  return `${prefix}_${rand}`
}

// ─── تطبيع النصوص (عربي + إنجليزي) لفحص التطابق ──────────────
/**
 * يوحّد الرسم العربي المتغيّر حتى لا يُعدّ «الإدارة» و«الاداره» بندين مختلفين.
 * يُستخدم في فحص التكرار فقط — لا يغيّر النصّ المخزَّن (يبقى كما كتبه المستخدم).
 */
export function normalizeText(text: string): string {
  let normalized = text.trim().toLowerCase()
  // إزالة التشكيل وعلامات الإعراب العربية
  normalized = normalized.replace(/[ً-ْ]/g, '')
  // توحيد همزات الألف
  normalized = normalized.replace(/[أإآ]/g, 'ا')
  // توحيد التاء المربوطة والهاء
  normalized = normalized.replace(/ة/g, 'ه')
  // توحيد الألف المقصورة والياء
  normalized = normalized.replace(/ى/g, 'ي')
  return normalized
}

// ─── فحص النظافة — للبنود الآليّة حصراً ──────────────────────
/**
 * يرمي إن احتوى نصٌّ آليّ (origin='auto') على ⟪ أو ⟫.
 * نصّ المستخدم يمرّ دائماً بلا فحص — رمز ⟪ اليدوي مشروع ويُحفظ كما هو.
 */
export function assertCleanText(text: string, origin: Origin, context = 'TaggedItem.text'): void {
  if (origin === 'auto' && FORBIDDEN_MARKERS.test(text)) {
    const preview = text.length > 100 ? `${text.slice(0, 100)}...` : text
    throw new Error(
      `[Article 1 violation] ${context}: auto-generated text must be clean of markers ⟪ or ⟫. ` +
      `Value: "${preview}"`,
    )
  }
}

// ─── إنشاء آمن مع validation ───────────────────────────────
export function createTaggedItem(input: {
  id?: string
  text: string
  origin: Origin
  source?: string
  reason?: string
  ts?: string
}): TaggedItem {
  assertCleanText(input.text, input.origin, 'createTaggedItem')
  return {
    id: input.id || genId(),
    // نصّ المستخدم مقدّس (بلا تعديل)؛ نقصّ مسافات النصّ الآلي فقط.
    text: input.origin === 'auto' ? input.text.trim() : input.text,
    origin: input.origin,
    ...(input.source ? { source: input.source } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.ts ? { ts: input.ts } : {}),
  }
}

// ─── شكل التخزين (يُكتب في JSON field على السيرفر) ───────────
/**
 * values: النصوص كما هي (قد يحوي اليدوي ⟪) · meta: metadata مفهرَسة بالـindex.
 * نُبقي meta دائماً لكل بند لضمان استمرار `id` و`origin` (حارس الهوية).
 */
export interface TaggedListStorage {
  values: string[]
  meta: Record<number, TaggedItemMeta>
}

export type TaggedItemMeta = Omit<TaggedItem, 'text'>

// ─── ترقية origin القديمة إلى النوع الجديد ───────────────────
function upgradeOrigin(raw: unknown): Origin {
  if (raw === 'auto') return 'auto'
  if (typeof raw === 'string' && raw.startsWith('user:')) return raw as Origin
  // 'user' المجرّدة أو غياب القيمة → سجلّ تاريخي يُرقّى بأمان.
  return 'user:legacy'
}

// ─── فكّ الصيغة القديمة (self-healing من ⟪مصدر:X⟫ ⟪لماذا:Y⟫) ───
// SWOT/TOWS قبل v1 كانا يكتبان العلامات داخل النصّ. هذه الدالّة تُنظّف النصّ
// وتنقل المصدر والسبب إلى الحقول. تُستدعى عند رؤية الشكل القديم string[].
const LEGACY_SOURCE_RX = /\s?⟪مصدر:([^⟫]+)⟫/
const LEGACY_REASON_RX = /\s?⟪لماذا:([^⟫]+)⟫/

export function fromLegacy(raw: string): TaggedItem {
  let text = raw
  let source: string | undefined
  let reason: string | undefined

  const sm = text.match(LEGACY_SOURCE_RX)
  if (sm) {
    source = sm[1].trim()
    text = text.replace(sm[0], '')
  }
  const rm = text.match(LEGACY_REASON_RX)
  if (rm) {
    reason = rm[1].trim()
    text = text.replace(rm[0], '')
  }

  // منع تلوّث بقايا الرموز في المُهاجَر (بيانات قديمة كانت العلامة فيها آليّة)
  text = text.replace(/⟪[^⟫]*⟫?/g, '').trim()

  const hasAutoMeta = source != null || reason != null
  return {
    id: genId(),
    text,
    origin: hasAutoMeta ? 'auto' : 'user:legacy',
    ...(source ? { source } : {}),
    ...(reason ? { reason } : {}),
  }
}

// ─── قراءة من التخزين (يقبل الشكل القديم والجديد) ────────
/**
 * القاعدة:
 *   • شكل جديد {values, meta} → يُقرأ مباشرةً (مع ترقية origin وحقن id)
 *   • شكل قديم string[] بعلامات ⟪⟫ → يُفكّ عبر fromLegacy
 *   • شكل قديم string[] بلا علامات → origin: 'user:legacy' (افتراض آمن)
 *   • أي شيء آخر → []
 */
export function fromStorage(raw: unknown): TaggedItem[] {
  // شكل جديد
  if (
    raw && typeof raw === 'object' && !Array.isArray(raw)
    && 'values' in raw && Array.isArray((raw as TaggedListStorage).values)
  ) {
    const s = raw as TaggedListStorage
    return s.values.map((text, i) => {
      const m = (s.meta ?? {})[i] ?? ({} as Partial<TaggedItemMeta>)
      return {
        id: m.id || genId(),
        text: typeof text === 'string' ? text : '',
        origin: upgradeOrigin(m.origin),
        ...(m.source ? { source: m.source } : {}),
        ...(m.reason ? { reason: m.reason } : {}),
        ...(m.ts ? { ts: m.ts } : {}),
      }
    })
  }

  // شكل قديم — string[]
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === 'string')
      .map(fromLegacy)
  }

  return []
}

// ─── الكتابة إلى التخزين (Article 1 مُطبَّق على الآلي فقط) ─────
export function toStorage(items: TaggedItem[]): TaggedListStorage {
  const values: string[] = []
  const meta: Record<number, TaggedItemMeta> = {}

  items.forEach((item, i) => {
    assertCleanText(item.text, item.origin, `toStorage[${i}]`)
    values.push(item.text)
    // meta دائماً محفوظة لضمان استمرار الهويّة (id) والأصل (origin).
    meta[i] = {
      id: item.id,
      origin: item.origin,
      ...(item.source ? { source: item.source } : {}),
      ...(item.reason ? { reason: item.reason } : {}),
      ...(item.ts ? { ts: item.ts } : {}),
    }
  })

  return { values, meta }
}

// ─── الدمج مع حماية اللمس اليدوي (Article 1 in action) ────
export interface MergeResult {
  merged: TaggedItem[]
  /** عدد البنود اليدويّة المحفوظة كما هي (بهويّتها). */
  kept: number
  /** عدد البنود الآليّة من نفس المصدر التي استُبدلت. */
  replaced: number
  /** عدد البنود الجديدة الصافية (بعد dedup). */
  added: number
  /** عدد الوارد المتخطّى لتطابقه (بعد التطبيع) مع نصّ قائم. */
  skipped_duplicates: number
}

/**
 * القاعدة المقدّسة:
 *   1. البنود اليدويّة (origin يبدأ بـ 'user:') تبقى بلا لمس — بهويّتها id.
 *   2. البنود الآليّة من مصادر أخرى تبقى (لا تمسح أتمتة PESTEL بنود التحليل العميق).
 *   3. البنود الآليّة من نفس المصدر تُستبدل بالكامل.
 *   4. الوارد يُصفّى من التكرار (تطبيع عربي) مع اليدوي وآليّ المصادر الأخرى —
 *      منعاً لإحياء ما حذفه المستخدم أو تكرار بندٍ ظاهر.
 *
 * حارس الهوية: U(existing) ≡ U(merged) حيث U = البنود اليدويّة بمعرّفاتها.
 */
export function mergePreservingUserEdits(
  existing: TaggedItem[],
  newAuto: Partial<TaggedItem>[],
  source: string,
): MergeResult {
  // 1. ختم الوارد كآليّ من هذا المصدر (الختم الفوري يمنع التراكم عند إعادة التوليد)
  const stamped: TaggedItem[] = newAuto.map((item, idx) => ({
    id: item.id || `auto_${source}_${idx}_${genId('n')}`,
    text: item.text ?? '',
    origin: 'auto' as const,
    source,
    ...(item.reason ? { reason: item.reason } : {}),
    ts: item.ts || new Date().toISOString(),
  }))

  // 2. عزل المجموعات
  const userItems = existing.filter((i) => i.origin.startsWith('user:'))
  const otherSourceAuto = existing.filter((i) => i.origin === 'auto' && i.source !== source)
  const oldSameSource = existing.filter((i) => i.origin === 'auto' && i.source === source)

  // 3. فحص التكرار مع التطبيع العربي — ضدّ اليدوي وآليّ المصادر الأخرى
  const seenNormalized = new Set<string>([
    ...userItems.map((i) => normalizeText(i.text)),
    ...otherSourceAuto.map((i) => normalizeText(i.text)),
  ])

  const filteredNewAuto: TaggedItem[] = []
  let skippedDuplicates = 0
  for (const item of stamped) {
    const key = normalizeText(item.text)
    if (seenNormalized.has(key)) {
      skippedDuplicates++
      continue
    }
    seenNormalized.add(key) // يمنع تكرار الوارد داخلياً أيضاً
    filteredNewAuto.push(item)
  }

  // 4. دمج المجموعات الثلاث المؤمّنة (اليدوي أولاً حفاظاً على ترتيبه/هويّته)
  const merged = [...userItems, ...otherSourceAuto, ...filteredNewAuto]

  return {
    merged,
    kept: userItems.length,
    replaced: oldSameSource.length,
    added: filteredNewAuto.length,
    skipped_duplicates: skippedDuplicates,
  }
}

// ─── مُلخّص Toast قابل للتراجع (الاختبار ٣) ───────────────
/**
 * ينسّق نتيجة الدمج كنصّ Toast:
 *   «حُفظت 3 يدويّة · حُدِّث 5 من PESTEL · جديد 2 · تخطّي مكرّر 1»
 * الـToast نفسه يُنشأ في UI مع زر «تراجع» يستعيد `existing` قبل الدمج.
 */
export function summarizeMerge(result: MergeResult, source: string): string {
  const parts: string[] = []
  if (result.kept > 0)               parts.push(`حُفظت ${result.kept} يدويّة`)
  if (result.replaced > 0)           parts.push(`حُدِّث ${result.replaced} من ${source}`)
  if (result.added > 0)              parts.push(`جديد ${result.added}`)
  if (result.skipped_duplicates > 0) parts.push(`تخطّي ${result.skipped_duplicates} مكرّر`)
  if (parts.length === 0) return `لا تغيير من ${source}`
  return parts.join(' · ')
}
