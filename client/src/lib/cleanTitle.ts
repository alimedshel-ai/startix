import { normalizeText } from './taggedItem'

// ─── تنظيف عنوان المبادرة — يمنع تسرّب نصّ TOWS الخام كعنوان ─────────
// النصّ الخام أمثلة:
//   «[WO] تتعامل مع تغييرات النطاق (Scope Creep)?: غير رسمي — fix to seize»
//   «⭐ [قرار] [WO] تتعامل مع تغييرات النطاق (Scope Creep)?…»  ← بادئات متعدّدة
// نستخرج الجوهر التصريحي: نُزيل الرموز الزخرفيّة + كل بادئات [كود] المتتالية
// (لا واحدة فقط) + الغراء الإنجليزي (— fix to …) + ما بعد «؟».

const LEADING_SYMBOLS = /^[\s⭐★☆🔴🟡🟢🟠🔵🚀•·✦❖◆▪▶←→]+/u
const LEADING_BRACKET = /^\[[^\]]{1,16}\]\s*/
const ENGLISH_GLUE = /\s*[—–-]\s*(fix|use|leverage|defend|seize|avoid|counter|exploit)\b.*$/i

export function cleanInitiativeTitle(raw: string): string {
  let t = (raw ?? '').trim()
  // نُقشّر الرموز والبادئات المتتالية بالتكرار حتى تستقرّ:
  //   «⭐ [قرار] [WO] X» → «[قرار] [WO] X» → «[WO] X» → «X»
  let prev: string
  do {
    prev = t
    t = t.replace(LEADING_SYMBOLS, '')
    t = t.replace(LEADING_BRACKET, '')
  } while (t !== prev)
  t = t.replace(ENGLISH_GLUE, '')   // «— fix to seize» ونحوه
  t = t.split(/[؟?]/)[0]            // خذ ما قبل أوّل علامة استفهام
  return t.replace(/\s+/g, ' ').trim()
}

// مفتاح الدمج: تنظيف ثم تطبيع عربي — فالنسخ شبه المتطابقة تتوحّد.
export function titleKey(raw: string): string {
  return normalizeText(cleanInitiativeTitle(raw))
}
