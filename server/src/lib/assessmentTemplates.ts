// ─── C19 — قوالب نماذج التقييم العالمية ────────────────────────────────────
// مصدر واحد للحقيقة لأشكال النماذج المدعومة (BSC، EFQM، PESTEL، PORTER، OKR).
// يستهلكها /api/assessments/templates و /api/assessments/from-template.
// كل قالب: مجموع أوزان الأبعاد = 100. المعايير داخل كل بُعد لها أوزان.

import type { Prisma } from '@prisma/client';

export type ModelType = 'BSC' | 'EFQM' | 'PESTEL' | 'PORTER' | 'OKR';

export interface TemplateCriterion {
  name: string;
  weight: number;
}

export interface TemplateDimension {
  name: string;
  weight: number;
  order: number;
  criteria: TemplateCriterion[];
}

export interface AssessmentTemplate {
  modelType: ModelType;
  displayName: string;
  description: string;
  dimensions: TemplateDimension[];
}

// ─── BSC — بطاقة الأداء المتوازن (4 أبعاد) ──────────────────────────────────
const BSC: AssessmentTemplate = {
  modelType: 'BSC',
  displayName: 'بطاقة الأداء المتوازن (BSC)',
  description: 'نموذج Kaplan & Norton — 4 منظورات متوازنة لقياس أداء المنشأة.',
  dimensions: [
    {
      name: 'المنظور المالي',
      weight: 25,
      order: 1,
      criteria: [
        { name: 'نموّ الإيرادات', weight: 50 },
        { name: 'الربحية والهامش', weight: 50 },
      ],
    },
    {
      name: 'منظور العملاء',
      weight: 25,
      order: 2,
      criteria: [
        { name: 'رضا العملاء (NPS/CSAT)', weight: 50 },
        { name: 'الاحتفاظ بالعملاء', weight: 50 },
      ],
    },
    {
      name: 'العمليات الداخلية',
      weight: 25,
      order: 3,
      criteria: [
        { name: 'كفاءة العمليات', weight: 50 },
        { name: 'الجودة ونسب الأخطاء', weight: 50 },
      ],
    },
    {
      name: 'التعلّم والنمو',
      weight: 25,
      order: 4,
      criteria: [
        { name: 'تطوير المهارات', weight: 50 },
        { name: 'الابتكار وثقافة التجربة', weight: 50 },
      ],
    },
  ],
};

// ─── EFQM — نموذج الامتياز الأوروبي (9 معايير) ─────────────────────────────
// 5 ممكِّنات + 4 نتائج، بأوزان مطابقة للنموذج التقليدي.
const EFQM: AssessmentTemplate = {
  modelType: 'EFQM',
  displayName: 'نموذج الامتياز EFQM',
  description: 'نموذج الامتياز الأوروبي — 5 ممكِّنات + 4 نتائج، مجموعها 100%.',
  dimensions: [
    { name: 'القيادة', weight: 10, order: 1,
      criteria: [
        { name: 'رؤية ورسالة القادة', weight: 50 },
        { name: 'إشراك القادة مع أصحاب المصلحة', weight: 50 },
      ],
    },
    { name: 'الاستراتيجية', weight: 10, order: 2,
      criteria: [
        { name: 'صياغة الاستراتيجية', weight: 50 },
        { name: 'تنفيذ ومراجعة الاستراتيجية', weight: 50 },
      ],
    },
    { name: 'الأفراد', weight: 10, order: 3,
      criteria: [
        { name: 'تطوير المواهب', weight: 50 },
        { name: 'اندماج الأفراد وتقديرهم', weight: 50 },
      ],
    },
    { name: 'الشراكات والموارد', weight: 10, order: 4,
      criteria: [
        { name: 'إدارة الشراكات الاستراتيجية', weight: 50 },
        { name: 'إدارة الموارد المالية والمادية', weight: 50 },
      ],
    },
    { name: 'العمليات والمنتجات والخدمات', weight: 10, order: 5,
      criteria: [
        { name: 'تصميم العمليات', weight: 50 },
        { name: 'تسليم المنتجات والخدمات', weight: 50 },
      ],
    },
    { name: 'نتائج الأفراد', weight: 10, order: 6,
      criteria: [
        { name: 'مؤشّرات الاندماج والرضا', weight: 100 },
      ],
    },
    { name: 'نتائج العملاء', weight: 15, order: 7,
      criteria: [
        { name: 'رضا العملاء وولاؤهم', weight: 100 },
      ],
    },
    { name: 'نتائج المجتمع', weight: 10, order: 8,
      criteria: [
        { name: 'الأثر البيئي والاجتماعي', weight: 100 },
      ],
    },
    { name: 'نتائج الأعمال', weight: 15, order: 9,
      criteria: [
        { name: 'المؤشرات المالية الرئيسية', weight: 50 },
        { name: 'المؤشرات غير المالية الاستراتيجية', weight: 50 },
      ],
    },
  ],
};

// ─── PESTEL — التحليل الكلي للبيئة (6 أبعاد) ────────────────────────────────
const PESTEL: AssessmentTemplate = {
  modelType: 'PESTEL',
  displayName: 'تحليل PESTEL',
  description: 'مسح البيئة الخارجية عبر 6 محاور: سياسية، اقتصادية، اجتماعية، تقنية، بيئية، قانونية.',
  dimensions: [
    { name: 'العوامل السياسية', weight: 17, order: 1,
      criteria: [
        { name: 'استقرار الحكومة والسياسات', weight: 50 },
        { name: 'اللوائح التجارية والضرائب', weight: 50 },
      ],
    },
    { name: 'العوامل الاقتصادية', weight: 17, order: 2,
      criteria: [
        { name: 'النموّ الاقتصادي والتضخّم', weight: 50 },
        { name: 'أسعار الفائدة والصرف', weight: 50 },
      ],
    },
    { name: 'العوامل الاجتماعية', weight: 17, order: 3,
      criteria: [
        { name: 'الديموغرافيا واتّجاهات المستهلك', weight: 50 },
        { name: 'الثقافة ونمط الحياة', weight: 50 },
      ],
    },
    { name: 'العوامل التقنية', weight: 17, order: 4,
      criteria: [
        { name: 'وتيرة الابتكار', weight: 50 },
        { name: 'الأتمتة والذكاء الاصطناعي', weight: 50 },
      ],
    },
    { name: 'العوامل البيئية', weight: 16, order: 5,
      criteria: [
        { name: 'الاستدامة والأثر البيئي', weight: 100 },
      ],
    },
    { name: 'العوامل القانونية', weight: 16, order: 6,
      criteria: [
        { name: 'التشريعات القطاعية والامتثال', weight: 100 },
      ],
    },
  ],
};

// ─── PORTER — قوى بورتر الخمس ──────────────────────────────────────────────
const PORTER: AssessmentTemplate = {
  modelType: 'PORTER',
  displayName: 'قوى بورتر الخمس',
  description: 'تحليل هيكل الصناعة عبر 5 قوى تنافسية بأوزان متساوية.',
  dimensions: [
    { name: 'شدّة التنافس بين المنافسين الحاليين', weight: 20, order: 1,
      criteria: [
        { name: 'عدد المنافسين والحصص السوقية', weight: 50 },
        { name: 'حروب الأسعار والتمايز', weight: 50 },
      ],
    },
    { name: 'قوّة الموردين', weight: 20, order: 2,
      criteria: [
        { name: 'تركّز الموردين وبدائلهم', weight: 100 },
      ],
    },
    { name: 'قوّة العملاء', weight: 20, order: 3,
      criteria: [
        { name: 'مرونة الطلب وحساسية السعر', weight: 100 },
      ],
    },
    { name: 'تهديد الداخلين الجدد', weight: 20, order: 4,
      criteria: [
        { name: 'حواجز الدخول ورأس المال المطلوب', weight: 100 },
      ],
    },
    { name: 'تهديد البدائل', weight: 20, order: 5,
      criteria: [
        { name: 'توفّر البدائل وتكلفة التحوّل', weight: 100 },
      ],
    },
  ],
};

// ─── OKR — تقييم منظومة الأهداف والنتائج الرئيسية ──────────────────────────
const OKR: AssessmentTemplate = {
  modelType: 'OKR',
  displayName: 'تقييم منظومة OKR',
  description: 'قياس نضج نظام OKR في الشركة عبر 3 محاور.',
  dimensions: [
    { name: 'صياغة الأهداف (Objectives)', weight: 33, order: 1,
      criteria: [
        { name: 'وضوح الأهداف وطموحها', weight: 50 },
        { name: 'ارتباطها بالاستراتيجية', weight: 50 },
      ],
    },
    { name: 'جودة النتائج الرئيسية (Key Results)', weight: 34, order: 2,
      criteria: [
        { name: 'قابليتها للقياس', weight: 50 },
        { name: 'الطموح مقابل الواقعية', weight: 50 },
      ],
    },
    { name: 'إيقاع التنفيذ والمراجعة', weight: 33, order: 3,
      criteria: [
        { name: 'اجتماعات مراجعة أسبوعية/ثنائية', weight: 50 },
        { name: 'ثقافة الشفافية والتعلّم', weight: 50 },
      ],
    },
  ],
};

export const TEMPLATES: Record<ModelType, AssessmentTemplate> = {
  BSC,
  EFQM,
  PESTEL,
  PORTER,
  OKR,
};

/**
 * يبني بيانات إنشاء متداخلة (Prisma nested-create) لتقييم كامل من قالب.
 * يستخدم فقط داخل الكونترولر لتفادي تكرار حرفي القالب.
 */
export function templateToCreateData(
  companyId: string,
  template: AssessmentTemplate,
  overrides: { name?: string; status?: 'draft' | 'active' | 'completed' | 'archived' } = {}
): Prisma.AssessmentUncheckedCreateInput {
  return {
    companyId,
    name: overrides.name ?? template.displayName,
    modelType: template.modelType,
    status: overrides.status ?? 'draft',
    dimensions: {
      create: template.dimensions.map((d) => ({
        name: d.name,
        weight: d.weight,
        order: d.order,
        criteria: {
          create: d.criteria.map((c) => ({
            name: c.name,
            weight: c.weight,
          })),
        },
      })),
    },
  };
}
