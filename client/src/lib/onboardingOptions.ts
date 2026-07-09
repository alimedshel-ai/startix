// ─── R1 — قوائم الآلام والأهداف الرسمية ──────────────────────────────
// المصدر: ملف الاقتراح «ربط أدوات التحليل الـ34 بمسار المدير المستقل».
// نُوثّق ٦ آلام و٧ أهداف بأكواد ثابتة تُستخدم كمفاتيح في:
//   • authStore.onboardingDraft (transient قبل التسجيل)
//   • User.pains / User.goals (بعد التسجيل)
//   • lib/goalGating (R3) — تفعيل/إخفاء الأدوات
//   • Priority Matrix / Eisenhower (R4) — ترتيب حسب الألم

import type { GoalCode, PainCode } from '@/types/user'

export interface OptionItem<Code extends string> {
  code: Code
  labelAr: string
  icon: string
  desc?: string
}

export const ONBOARDING_PAINS: OptionItem<PainCode>[] = [
  { code: 'no_kpis',      icon: '📊', labelAr: 'لا مؤشرات أداء واضحة',        desc: 'لا أعرف كيف أقيس النتائج.' },
  { code: 'no_alignment', icon: '🧭', labelAr: 'لا مواءمة بين الأقسام',      desc: 'كل قسم يعمل باتجاه مختلف.' },
  { code: 'team_lost',    icon: '👥', labelAr: 'الفريق تائه',                desc: 'الفريق لا يعرف الأولويات.' },
  { code: 'no_data',      icon: '🗂️', labelAr: 'بلا بيانات موثوقة',          desc: 'القرارات تُتّخذ بالحدس.' },
  { code: 'no_time',      icon: '⏱️', labelAr: 'لا وقت للتخطيط',             desc: 'مشغول بالطوارئ اليومية.' },
  { code: 'no_budget',    icon: '💰', labelAr: 'ميزانية ضيّقة',               desc: 'موارد محدودة للتنفيذ.' },
]

export const ONBOARDING_GOALS: OptionItem<GoalCode>[] = [
  { code: 'improve',   icon: '⬆️', labelAr: 'تحسين الأداء العام',          desc: 'رفع مؤشرات الأداء.' },
  { code: 'reports',   icon: '📑', labelAr: 'تقارير أوضح للإدارة',          desc: 'قياس دوري ورؤية شفافة.' },
  { code: 'plan',      icon: '🗺️', labelAr: 'خطة استراتيجية سنوية',         desc: 'خارطة طريق ١٢ شهراً.' },
  { code: 'kpis',      icon: '📊', labelAr: 'بناء KPIs قابلة للقياس',        desc: 'مؤشرات SMART لكل هدف.' },
  { code: 'alignment', icon: '🔗', labelAr: 'مواءمة الفريق مع الاستراتيجية', desc: 'كل عضو يعرف دوره.' },
  { code: 'team',      icon: '🎯', labelAr: 'تطوير الفريق',                 desc: 'مهارات وأداء أعلى.' },
  { code: 'swot',      icon: '🧭', labelAr: 'تحليل SWOT إداري',              desc: 'قوة/ضعف/فرص/تهديدات.' },
]

// R1 — أنواع الكيان القانوني السعودي (الأكثر شيوعاً).
export const ENTITY_TYPES: { code: string; labelAr: string }[] = [
  { code: 'LLC',              labelAr: 'شركة ذات مسؤولية محدودة (LLC)' },
  { code: 'JSC',              labelAr: 'شركة مساهمة (JSC)' },
  { code: 'SOLE_PROPRIETOR',  labelAr: 'مؤسسة فردية' },
  { code: 'PARTNERSHIP',      labelAr: 'شركة تضامن' },
  { code: 'BRANCH',           labelAr: 'فرع لشركة أجنبية' },
  { code: 'NGO',              labelAr: 'جمعية / منشأة غير ربحية' },
]

// R1 — قطاعات رئيسية (اختصار لقطاعات رؤية 2030 الاقتصادية).
export const SECTORS: { code: string; labelAr: string }[] = [
  { code: 'technology',    labelAr: 'التقنية' },
  { code: 'retail',        labelAr: 'التجزئة' },
  { code: 'manufacturing', labelAr: 'الصناعة والتصنيع' },
  { code: 'healthcare',    labelAr: 'الرعاية الصحية' },
  { code: 'education',     labelAr: 'التعليم' },
  { code: 'financial',     labelAr: 'المالية والمصرفية' },
  { code: 'realestate',    labelAr: 'العقار والإنشاءات' },
  { code: 'hospitality',   labelAr: 'الضيافة والسياحة' },
  { code: 'logistics',     labelAr: 'اللوجستيات والنقل' },
  { code: 'energy',        labelAr: 'الطاقة' },
  { code: 'agriculture',   labelAr: 'الزراعة والأغذية' },
  { code: 'consulting',    labelAr: 'الاستشارات والخدمات المهنية' },
  { code: 'other',         labelAr: 'أخرى' },
]
