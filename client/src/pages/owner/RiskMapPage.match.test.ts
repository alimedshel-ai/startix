import { describe, it, expect } from 'vitest'
import { findRiskTemplate, matchRiskTemplate, deptMitigationPool, diagnosisMitigations } from './riskTemplates'

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

  it('بلا تخصّص: المطابقة تعمل عبر كلّ الأقسام (لم تعد مقيّدة بالتخصّص)', () => {
    expect(matchRiskTemplate('استقالة الموظفين', null)?.name).toBe('استقالة مواهب رئيسيّة')
  })
  it('اسم فارغ → undefined', () => {
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

// كتالوج التشخيص هو المصدر الأدقّ للمخاطر المستوردة — يغطّي بنودها الفعليّة.
describe('diagnosisMitigations — تطابق كتالوج التشخيص (بيانات العميل الحقيقيّة)', () => {
  // عيّنة من الأسماء المحفوظة فعلاً لهذا العميل (٢٦ خطراً «[تشخيص] …»).
  const realNames = [
    '[تشخيص] عمليات غير مؤتمتة (اعتماد يدوي مفرط)',
    '[تشخيص] إدخال البيانات اليدوي',
    '[تشخيص] الموافقات والاعتمادات',
    '[تشخيص] المراجعات الدورية',
    '[تشخيص] الأرشفة وإدارة الملفات',
    '[تشخيص] سلسلة التوريد أو الإمداد',
    '[تشخيص] الأمن السيبراني والبيانات',
    '[تشخيص] تجديد التراخيص والاعتمادات',
  ]
  it('كلّ بنود التشخيص المستوردة تُطابَق وتُرجِع ٣ اقتراحات', () => {
    for (const n of realNames) {
      const m = diagnosisMitigations(n)
      expect(m, n).toBeDefined()
      expect(m!.length).toBe(3)
    }
  })
  it('يتجاهل بادئة «[تشخيص]» تلقائيّاً (التطبيع)', () => {
    expect(diagnosisMitigations('[تشخيص] الأرشفة وإدارة الملفات'))
      .toEqual(diagnosisMitigations('الأرشفة وإدارة الملفات'))
  })
  it('بند غير موجود في الكتالوج → undefined', () => {
    expect(diagnosisMitigations('[تشخيص] شيء غير موجود إطلاقاً')).toBeUndefined()
  })
})

describe('matchRiskTemplate — مطابقة عبر كلّ الأقسام (لا تخصّص المدير فقط)', () => {
  it('مدير HR: خطر توريد يطابق قالب العمليّات (عبر القسم)', () => {
    expect(matchRiskTemplate('[تشخيص] سلسلة التوريد أو الإمداد', 'HR')?.name).toBe('انقطاع سلسلة التوريد')
  })
})

describe('deptMitigationPool — مجموعة القسم الاحتياطيّة (بلا تكرار)', () => {
  it('HR يرجع اقتراحات فريدة للعرض المطويّ', () => {
    const pool = deptMitigationPool('HR')
    expect(pool.length).toBeGreaterThan(0)
    expect(new Set(pool).size).toBe(pool.length)
  })
})
