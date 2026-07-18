import { describe, expect, it } from 'vitest'

import { cleanInitiativeTitle, titleKey } from './cleanTitle'

const RAW_SCOPE = 'تتعامل مع تغييرات النطاق (Scope Creep)'

describe('cleanInitiativeTitle', () => {
  // 🔴 الحالة التي كسرت الدالّة المحلّيّة — بادئات متعدّدة + رمز (بند القرار).
  it('يعالج البادئات المتعدّدة ⭐ [قرار] [WO] (الحالة التي فشلت سابقاً)', () => {
    expect(cleanInitiativeTitle('⭐ [قرار] [WO] تتعامل مع تغييرات النطاق (Scope Creep)?: غير رسمي — fix to seize'))
      .toBe(RAW_SCOPE)
  })

  it('يزيل بادئة كود واحدة [WO]', () => {
    expect(cleanInitiativeTitle('[WO] تتعامل مع تغييرات النطاق (Scope Creep)')).toBe(RAW_SCOPE)
  })

  it('يزيل الغراء الإنجليزي — fix to X', () => {
    expect(cleanInitiativeTitle('تتعامل مع تغييرات النطاق (Scope Creep) — fix to defend')).toBe(RAW_SCOPE)
  })

  it('يقصّ ما بعد علامة الاستفهام (سؤال؟: إجابة)', () => {
    expect(cleanInitiativeTitle('تتعامل مع تغييرات النطاق (Scope Creep)?: غير رسمي')).toBe(RAW_SCOPE)
  })

  it('لا يمسّ عنواناً نظيفاً كتبه المستخدم', () => {
    expect(cleanInitiativeTitle('برنامج تحسين المخرجات')).toBe('برنامج تحسين المخرجات')
  })

  it('يوحّد الفراغات المكرّرة', () => {
    expect(cleanInitiativeTitle('إطلاق   مساحة  تعليم')).toBe('إطلاق مساحة تعليم')
  })

  it('نصّ فارغ/رموز فقط → سلسلة فارغة', () => {
    expect(cleanInitiativeTitle('⭐ [قرار] ')).toBe('')
    expect(cleanInitiativeTitle('')).toBe('')
  })
})

describe('titleKey — دمج شبه المتطابق', () => {
  it('النسخ الأربع (fix to seize/defend + [WO]/[WT]) تُنتج نفس المفتاح', () => {
    const variants = [
      '[WO] تتعامل مع تغييرات النطاق (Scope Creep)?: غير رسمي — fix to seize',
      '[WT] تتعامل مع تغييرات النطاق (Scope Creep)?: غير رسمي — fix to defend',
      '⭐ [قرار] [WO] تتعامل مع تغييرات النطاق (Scope Creep)?',
    ]
    const keys = new Set(variants.map(titleKey))
    expect(keys.size).toBe(1)   // كلها تتوحّد
  })

  it('عنوانان مختلفان → مفتاحان مختلفان', () => {
    expect(titleKey('برنامج تحسين المخرجات')).not.toBe(titleKey('إطلاق مساحة تعليم'))
  })
})

// حارس التراكم — نفس آليّة المولّد (Set من titleKey للقاعدة، ثم فحص الوارد).
// يثبت: «ولّد» على قاعدة فيها العنوان أصلاً (بأي صياغة خام) → صفر إضافة.
describe('حارس التراكم — الدمج مع مبادرات القاعدة قبل الإدراج', () => {
  it('عنوان موجود في القاعدة (بصياغة خام مختلفة) → يُتخطّى (صفر إضافة)', () => {
    // القاعدة فيها الصياغة الخام القديمة:
    const dbTitles = ['[WO] تتعامل مع تغييرات النطاق (Scope Creep)?: غير رسمي — fix to seize']
    const existing = new Set(dbTitles.map(titleKey))
    // «ولّد» يُنتج نفس المبادرة بصياغة أخرى (قرار/ربع مختلف):
    const candidates = [
      '⭐ [قرار] [WO] تتعامل مع تغييرات النطاق (Scope Creep)?',
      '[WT] تتعامل مع تغييرات النطاق (Scope Creep)?: … — fix to defend',
    ]
    const toCreate = candidates.filter((c) => !existing.has(titleKey(c)))
    expect(toCreate.length).toBe(0)   // ← لا تراكم: كلها موجودة أصلاً
  })

  it('عنوان جديد فعلاً → يُدرَج (إضافة واحدة)', () => {
    const existing = new Set(['برنامج تحسين المخرجات'].map(titleKey))
    const candidates = ['برنامج تحسين المخرجات', 'إطلاق مساحة تعليم']  // الأوّل موجود، الثاني جديد
    const toCreate = candidates.filter((c) => !existing.has(titleKey(c)))
    expect(toCreate).toEqual(['إطلاق مساحة تعليم'])
  })
})
