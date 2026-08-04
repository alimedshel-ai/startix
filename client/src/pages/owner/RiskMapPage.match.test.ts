import { describe, it, expect } from 'vitest'
import { findRiskTemplate, matchRiskTemplate, deptMitigationPool } from './riskTemplates'

// شرط القبول: مخاطر محفوظة اسمها يبدأ بـ«[تشخيص]» يجب أن تُطابق قوالب HR بعد
// إصلاح المطابقة (تجاهُل البادئة + تطبيع + إزالة واو الوصل + تقاطع كلمات).
describe('matchRiskTemplate — مطابقة ذكيّة للأسماء المستوردة', () => {
  it('«[تشخيص] استقالة الموظفين» يطابق قالب الاستقالة (مثال المستخدم)', () => {
    const m = matchRiskTemplate('[تشخيص] استقالة الموظفين', 'HR')
    expect(m?.name).toBe('استقالة مواهب رئيسيّة')
  })

  it('واو الوصل لا تكسر التطابق: «التعيينات والتوظيف» يطابق قالب التوظيف', () => {
    const m = matchRiskTemplate('[تشخيص] التعيينات والتوظيف', 'HR')
    expect(m?.name).toBe('صعوبة التوظيف في وقت الطوارئ')
  })

  it('يطبّع الهمزات والتاء المربوطة: «عدم الامتثال لانظمة العمل»', () => {
    const m = matchRiskTemplate('عدم الامتثال لانظمة العمل', 'HR')
    expect(m?.name).toBe('عدم الامتثال لأنظمة العمل')
  })

  it('لا تطابق زائف: اسم بلا كلمة مشتركة يرجع undefined', () => {
    expect(matchRiskTemplate('[تشخيص] الأرشفة وإدارة الملفات', 'HR')).toBeUndefined()
    expect(matchRiskTemplate('[تشخيص] جدولة المواعيد', 'HR')).toBeUndefined()
  })

  it('بلا تخصّص أو اسم فارغ → undefined', () => {
    expect(matchRiskTemplate('استقالة الموظفين', null)).toBeUndefined()
    expect(matchRiskTemplate('   ', 'HR')).toBeUndefined()
  })
})

// لا انحدار: المسار الحرفيّ القديم (أضف جديد ← اكتب/اختر اسماً معروفاً) يبقى صارماً.
describe('findRiskTemplate — تطابق حرفيّ (المسار القديم) بلا انحدار', () => {
  it('الاسم المعروف تماماً يُطابق', () => {
    expect(findRiskTemplate('استقالة مواهب رئيسيّة', 'HR')?.impact).toBe(4)
  })
  it('البادئة «[تشخيص]» لا تُطابق حرفيّاً (صارم عمداً — لا ملء تلقائيّ خاطئ)', () => {
    expect(findRiskTemplate('[تشخيص] استقالة الموظفين', 'HR')).toBeUndefined()
  })
})

describe('deptMitigationPool — مجموعة القسم الاحتياطيّة (بلا تكرار)', () => {
  it('HR يرجع اقتراحات فريدة للعرض المطويّ', () => {
    const pool = deptMitigationPool('HR')
    expect(pool.length).toBeGreaterThan(0)
    expect(new Set(pool).size).toBe(pool.length)
  })
})
