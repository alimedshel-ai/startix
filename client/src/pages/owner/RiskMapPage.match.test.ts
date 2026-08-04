import { describe, it, expect } from 'vitest'
import { findRiskTemplate, matchRiskTemplate, deptMitigationPool, riskSuggestion, riskNameFromTaskTitle } from './riskTemplates'

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

// riskSuggestion = كتالوج التشخيص (الأدقّ للمستوردة) ← بنك الأقسام. يُرجِع تقييماً
// متوقّعاً + ٣ تخفيفات — مصدر الرقائق وزرّ «طبّق التقييم المتوقّع».
describe('riskSuggestion — اقتراح موحَّد (بيانات العميل الحقيقيّة)', () => {
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
  it('كلّ بند مستورد يُرجِع ٣ تخفيفات + تقييماً متوقّعاً صالحاً (١–٥)', () => {
    for (const n of realNames) {
      const s = riskSuggestion(n, 'HR')
      expect(s, n).toBeDefined()
      expect(s!.mitigations.length).toBe(3)
      expect(s!.probability).toBeGreaterThanOrEqual(1)
      expect(s!.probability).toBeLessThanOrEqual(5)
      expect(s!.impact).toBeGreaterThanOrEqual(1)
      expect(s!.impact).toBeLessThanOrEqual(5)
    }
  })
  it('التقييم المتوقّع ليس ١×١ (يغني عن الضبط اليدويّ)', () => {
    const s = riskSuggestion('[تشخيص] التدفق المالي / السيولة اليومية', 'HR')!
    expect(s.probability * s.impact).toBeGreaterThan(1)
  })
  it('كتالوج التشخيص يسبق بنك الأقسام (المصدر الأدقّ للمستوردة)', () => {
    // «سلسلة التوريد» بند تشخيص P3×I4؛ لو غلب البنك لكان قالب العمليّات (نفس القيم هنا).
    const s = riskSuggestion('[تشخيص] سلسلة التوريد أو الإمداد', 'HR')!
    expect(s.mitigations[0]).toBe('تأهيل مورّد ثانٍ لكلّ صنف حرج')
  })
  it('يتجاهل بادئة «[تشخيص]» تلقائيّاً', () => {
    expect(riskSuggestion('[تشخيص] الأرشفة وإدارة الملفات', 'HR'))
      .toEqual(riskSuggestion('الأرشفة وإدارة الملفات', 'HR'))
  })
  it('بند بلا كتالوج وبلا قالب → undefined (يسقط للمطويّة)', () => {
    expect(riskSuggestion('[تشخيص] شيء غير موجود إطلاقاً', 'HR')).toBeUndefined()
  })
  it('عبر الأقسام: خطر توريد يُرجِع اقتراحاً ولو كان المدير HR', () => {
    expect(riskSuggestion('انقطاع سلسلة التوريد', 'HR')).toBeDefined()
  })
})

// مهامّ «معالجة: <خطر>»: المهامّ الفرعيّة = تخفيفات الخطر (لا القالب العامّ المكرّر).
describe('riskNameFromTaskTitle + subtasks — اشتقاق فرعيّات المعالجة', () => {
  it('يستخرج اسم الخطر من عنوان المعالجة (مع/بلا 🔧)', () => {
    expect(riskNameFromTaskTitle('🔧 معالجة: عمليات غير مؤتمتة (اعتماد يدوي مفرط)'))
      .toBe('عمليات غير مؤتمتة (اعتماد يدوي مفرط)')
    expect(riskNameFromTaskTitle('معالجة: نقص البيانات لاتخاذ القرار')).toBe('نقص البيانات لاتخاذ القرار')
  })
  it('مهمّة عاديّة (لا بادئة معالجة) → null (تبقى للمولّد العامّ)', () => {
    expect(riskNameFromTaskTitle('تجهيز التقرير الشهريّ')).toBeNull()
  })
  it('فرعيّات المعالجة محدّدة بالخطر لا مكرّرة: كلّ خطر يعطي تخفيفاته الثلاثة', () => {
    const a = riskSuggestion(riskNameFromTaskTitle('🔧 معالجة: عمليات غير مؤتمتة (اعتماد يدوي مفرط)')!, 'HR')!.mitigations
    const b = riskSuggestion(riskNameFromTaskTitle('🔧 معالجة: قيود مالية (ميزانية محدودة أو تكاليف مرتفعة)')!, 'HR')!.mitigations
    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
    expect(a).not.toEqual(b) // ليست «نفس المقترح»
    // «قيود مالية» لا تُنتج «الدفع للمورّد» (عطل المولّد العامّ)
    expect(b.join(' ')).not.toContain('الدفع للمورّد')
  })
})

describe('deptMitigationPool — مجموعة القسم الاحتياطيّة (بلا تكرار)', () => {
  it('HR يرجع اقتراحات فريدة للعرض المطويّ', () => {
    const pool = deptMitigationPool('HR')
    expect(pool.length).toBeGreaterThan(0)
    expect(new Set(pool).size).toBe(pool.length)
  })
})
