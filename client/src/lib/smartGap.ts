// ─── تحليل ذكي للفجوات ───────────────────────────────────────────
// المصدر: DeptAudit.scores (٤ محاور نضج ثابتة) + التخصّص + OPEX + آلام.
// المخرج: قائمة GapItem بمحاور تلقائية، قيم current/target محسوبة،
// وخطة معالجة مقترحة من بنك (٤ محاور × ١٣ تخصّص).
//
// current: من درجة المحور في آخر تدقيق (0..100).
// target : المستوى التالي الطبيعي (كل +20 نقطة حتى 95).
// action : من AXIS_PLAYBOOK[axis][specialty] — أفكار جاهزة.

import type { DeptCode } from './deptApi'
import type { OpexData } from '@/types/user'

export type AuditAxis = 'governance' | 'financial' | 'team' | 'digital'

const AXIS_LABEL_AR: Record<AuditAxis, string> = {
  governance: 'الحوكمة والسياسات',
  financial:  'المالية والكفاءة',
  team:       'الفريق والقدرات',
  digital:    'الرقمي والأتمتة',
}

export interface SmartGapItem {
  axis: string          // نص المحور بالعربي (يُخزّن كاسم)
  axisKey: AuditAxis    // مفتاح المحور الأصلي
  current: number       // 0..100
  target: number        // 0..100
  action: string        // خطة معالجة
  source: 'audit' | 'deep' | 'opex' | 'goal-target'
  rationale: string     // شرح السبب
}

interface Ctx {
  specialty: DeptCode | null
  opex: OpexData
  pains: string[]
  goals: string[]
  auditScores: Partial<Record<AuditAxis, number>> | null  // 0..100 per axis
  auditHealthPct: number | null                            // 0..100
}

// ─── بنك أفكار المعالجة حسب (المحور × التخصّص) ─────────────────
// كل قيمة سطر معالجة مختصر (٢-٤ سطور). المستخدم يستطيع التعديل.
const AXIS_PLAYBOOK: Record<AuditAxis, Partial<Record<DeptCode, string>>> = {
  governance: {
    HR:               'اعتماد سياسات HR رسمية (توظيف/إجازات/إنهاء). دورة تقييم أداء سنوية موثّقة. مسار تعاقب للمناصب الحرجة.',
    FINANCE:          'مصفوفة صلاحيات مالية معتمَدة. لجنة تدقيق داخلية. دورة إغلاق شهري موثّقة.',
    SALES:            'دورة اعتماد للتخفيضات والعقود. سياسة تسعير رسمية. حوكمة قنوات البيع.',
    MARKETING:        'دليل هوية العلامة. سياسة استخدام محتوى. حوكمة قنوات الإعلان والصلاحيات.',
    OPERATIONS:       'SOPs مكتوبة لكل عملية أساسية. سجل تعديلات. مراجعات ربعية.',
    IT:               'سياسة أمن معلومات مكتوبة. حوكمة تغيير (Change Management). RACI للطوارئ.',
    CUSTOMER_SERVICE: 'سياسة SLA رسمية. دليل تصعيد. سجل شكاوى موثّق.',
    SUPPORT:          'سياسة مشتريات. مصفوفة صلاحيات صرف. حوكمة الموردين.',
    LOGISTICS:        'سياسة إدارة المخزون. حوكمة عقود الناقلين. سجل حوادث.',
    QUALITY:          'شهادة ISO 9001 أو ما يوازيها. سياسة CAPA. سجل عدم مطابقة.',
    PROJECTS:         'ميثاق مشاريع (PMO Charter). دورة اعتماد مراحل. حوكمة تغييرات النطاق.',
    COMPLIANCE:       'مصفوفة التزامات تنظيمية. دورة مراجعة. تقارير للجنة تدقيق.',
    GOVERNANCE:       'ميثاق مجلس الإدارة. لوائح اللجان. سياسات إفصاح شفافة.',
  },
  financial: {
    HR:               'مراجعة سلم الرواتب حسب سوق السعودية. نمذجة تكلفة الموظف الكاملة. قياس ROI للتدريب.',
    FINANCE:          'نظام محاسبي متكامل. دورة إقفال شهري ≤ ٥ أيام. لوحة KPIs مالية أسبوعية.',
    SALES:            'قياس CAC و LTV. نمذجة توقعات الإيراد. دورة تحصيل ≤ ٤٥ يوم.',
    MARKETING:        'قياس ROAS لكل قناة. ميزانية موزّعة حسب مساهمة القناة. دورة تحسين شهرية.',
    OPERATIONS:       'حساب تكلفة الوحدة. تتبّع OEE. نمذجة توفير من Lean.',
    IT:               'كشف تكاليف السحابة (FinOps). تخصيص التكلفة بحسب القسم. توفير من ترشيد.',
    CUSTOMER_SERVICE: 'تكلفة الاتصال الواحد. قياس CSAT-Cost Trade-Off. توفير من التذاكر الآلية.',
    SUPPORT:          'تفاوض عقود مورّدين سنوياً. تجميع المشتريات. حساب TCO.',
    LOGISTICS:        'تكلفة الشحن/طلب. تحسين مسارات. تفاوض تعرفة ناقلين.',
    QUALITY:          'تكلفة الجودة (COQ). قياس تكلفة عدم المطابقة. ROI شهادات جودة.',
    PROJECTS:         'انحراف الميزانية ≤ ٥٪. تقدير تكلفة دقيق (Bottom-up). أدوات تتبّع مالي.',
    COMPLIANCE:       'حساب تكلفة الالتزام مقابل الغرامات المتجنّبة. ميزانية التدريب. TCO للأنظمة.',
    GOVERNANCE:       'نموذج تعويض المجلس. تكاليف الاجتماعات والاستشارات. ROI الحوكمة.',
  },
  team: {
    HR:               'برنامج تأهيل ٩٠ يوم. خطة تدريب فردية. استبيان اندماج ربعي.',
    FINANCE:          'تدريب على المعايير المحاسبية. شهادات مهنية (CMA/SOCPA). خطة تعاقب.',
    SALES:            'برنامج تدريب مبيعات مستمر. Coaching للمديرين. تحفيز مبني على الأداء.',
    MARKETING:        'تطوير مهارات رقمية. Certifications (Google/Meta). ورش إبداعية.',
    OPERATIONS:       'شهادات Lean/Six Sigma. تدريب على الآلات. برامج قيادة تشغيلية.',
    IT:               'شهادات تقنية معتمَدة. برامج DevOps. مسار وظيفي واضح.',
    CUSTOMER_SERVICE: 'تدريب على التعاطف والاتصال. سيناريوهات محاكاة. برامج قيادة الفرق.',
    SUPPORT:          'تدريب على إدارة الموردين. مهارات تفاوض. تخصّص في المشتريات.',
    LOGISTICS:        'تدريب مشغّلي مستودعات. شهادات في سلسلة الإمداد. برامج قيادة.',
    QUALITY:          'شهادات جودة (Green Belt/Black Belt). تدريب على تدقيق داخلي.',
    PROJECTS:         'شهادات PMP/Prince2. تدريب على Agile/Scrum. Coaching للـPMO.',
    COMPLIANCE:       'شهادات (CAMS/CFE). تحديث دوري بالأنظمة. ورش لأصحاب المصلحة.',
    GOVERNANCE:       'برامج تأهيل أعضاء المجلس. Coaching للجان. تحديث حوكمي دوري.',
  },
  digital: {
    HR:               'HRIS متكامل (توظيف/رواتب/تقييم). أتمتة الإجازات والتسوية. تحليلات أداء ذكية.',
    FINANCE:          'ERP سحابي. أتمتة الفواتير. لوحات BI مالية. تكامل مع البنوك.',
    SALES:            'CRM متكامل مع أتمتة (HubSpot/Salesforce). قنوات رقمية. تحليلات فرص.',
    MARKETING:        'أتمتة تسويقية شاملة. تحليلات متعدّدة القنوات. اختبار A/B مستمر.',
    OPERATIONS:       'IoT للمعدّات. أتمتة سير عمل (RPA). لوحات إنتاج مباشرة (Andon).',
    IT:               'سحابة متعدّدة. DevOps CI/CD. مراقبة استباقية 24/7.',
    CUSTOMER_SERVICE: 'شات‑بوت ذكاء اصطناعي. قاعدة معرفة رقمية. قنوات موحّدة (Omnichannel).',
    SUPPORT:          'نظام مشتريات إلكتروني (e-procurement). كتالوج مورّدين موحّد. تكامل مع ERP.',
    LOGISTICS:        'نظام إدارة مستودعات WMS. تتبّع GPS لحظي. تكامل مع منصات الناقلين.',
    QUALITY:          'نظام إدارة جودة (QMS) رقمي. أدوات تحليل جذور الأسباب. SPC حي.',
    PROJECTS:         'أدوات إدارة مشاريع سحابية. لوحات Gantt/Kanban. تكامل مع الموارد.',
    COMPLIANCE:       'نظام GRC متكامل. مسح تنظيمي رقمي. تنبيهات تلقائية للمواعيد.',
    GOVERNANCE:       'منصة مجلس إدارة إلكترونية (Board Portal). أرشيف قرارات. توقيع رقمي.',
  },
}

// المستوى التالي: كل +20 حتى 95؛ لو المحور ≥ 80 لا نُنشئ فجوة.
function nextTarget(current: number): number {
  if (current >= 80) return 95
  if (current >= 60) return 85
  if (current >= 40) return 70
  if (current >= 20) return 55
  return 40
}

function severityFromDiff(diff: number): 'small' | 'medium' | 'large' {
  if (diff >= 30) return 'large'
  if (diff >= 15) return 'medium'
  return 'small'
}

export function generateSmartGaps(ctx: Ctx): SmartGapItem[] {
  const out: SmartGapItem[] = []
  if (!ctx.specialty) return out

  // 1) فجوات من محاور التدقيق (الأهم).
  if (ctx.auditScores) {
    for (const axis of ['governance', 'financial', 'team', 'digital'] as AuditAxis[]) {
      const cur = ctx.auditScores[axis]
      if (cur == null || cur >= 90) continue
      const tgt = nextTarget(cur)
      const diff = tgt - cur
      const sev = severityFromDiff(diff)
      const label = AXIS_LABEL_AR[axis]
      const action = AXIS_PLAYBOOK[axis][ctx.specialty] ??
        'خطة معالجة تحتاج تفصيلاً حسب سياق الإدارة والقطاع.'
      out.push({
        axis: label,
        axisKey: axis,
        current: Math.round(cur),
        target: tgt,
        action,
        source: 'audit',
        rationale: `درجة المحور في آخر تدقيق ${Math.round(cur)}٪ — الفجوة ${diff} نقطة (${sev === 'large' ? 'كبيرة' : sev === 'medium' ? 'متوسطة' : 'صغيرة'}).`,
      })
    }
  }

  // 2) فجوة استراتيجية من المستهدف السنوي (لو current محسوب من الصحة).
  if (ctx.opex.target && ctx.auditHealthPct != null && ctx.auditHealthPct < 70) {
    out.push({
      axis: 'تحقيق المستهدف السنوي',
      axisKey: 'financial',
      current: Math.round(ctx.auditHealthPct),
      target: 85,
      action: `المستهدف ${ctx.opex.target.toLocaleString('ar-SA')} ر.س. رفع الصحة إلى 85٪ يزيد احتمال التحقيق. ركّز على أعلى ٣ فجوات محورية أعلاه.`,
      source: 'opex',
      rationale: 'الصحة الحالية أقل من ٧٠٪ — تُعرقل تحقيق المستهدف.',
    })
  }

  // 3) لو ما فيه تدقيق أصلاً — نُنشئ ٤ فجوات "خام" بقيم افتراضية.
  if (!ctx.auditScores || Object.keys(ctx.auditScores).length === 0) {
    for (const axis of ['governance', 'financial', 'team', 'digital'] as AuditAxis[]) {
      const label = AXIS_LABEL_AR[axis]
      const action = AXIS_PLAYBOOK[axis][ctx.specialty] ?? 'تحتاج تحليل عميق أوّلاً.'
      out.push({
        axis: label,
        axisKey: axis,
        current: 40,  // افتراضي — المستخدم يعدّله
        target: 70,
        action,
        source: 'audit',
        rationale: 'لا يوجد تدقيق بعد — نقدّم فجوات محاور نموذجية بقيم افتراضية للتعديل.',
      })
    }
  }

  return out
}
