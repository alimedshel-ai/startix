// Compliance audit (Pro) — 64 mandatory elements across 8 axes, plus a
// contextual layer of up to 10 sector-specific axes activated when a sector
// is provided. See plan §5.3.

import type { DeptQuestion } from './deptQuestions';

export type ComplianceAxisKey =
  // 8 mandatory axes
  | 'commercial'
  | 'tax_zakat'
  | 'labor_saudization'
  | 'data_privacy'
  | 'cybersecurity'
  | 'corporate_gov'
  | 'aml_kyc'
  | 'consumer_protection'
  // 10 contextual axes
  | 'health_safety'
  | 'environment'
  | 'food_safety'
  | 'medical_devices'
  | 'pharma'
  | 'banking_sama'
  | 'capital_markets_cma'
  | 'telecom_cst'
  | 'construction_safety'
  | 'export_import_customs';

export interface ComplianceAxisDef {
  key: ComplianceAxisKey;
  label: string;
  regulator: string;
  mandatory: boolean;
  /** Sectors that activate this axis. Mandatory axes are always active. */
  sectors?: string[];
}

export const COMPLIANCE_AXES: ComplianceAxisDef[] = [
  // 8 إلزامية
  { key: 'commercial',          label: 'التراخيص التجارية',                regulator: 'وزارة التجارة / البلدية',  mandatory: true },
  { key: 'tax_zakat',            label: 'الضرائب والزكاة',                  regulator: 'زاتكا',                    mandatory: true },
  { key: 'labor_saudization',    label: 'العمل والسعودة',                   regulator: 'الموارد البشرية / التأمينات', mandatory: true },
  { key: 'data_privacy',         label: 'حماية البيانات (PDPL)',            regulator: 'سدايا',                    mandatory: true },
  { key: 'cybersecurity',        label: 'الأمن السيبراني (ECC)',            regulator: 'الهيئة الوطنية للأمن السيبراني', mandatory: true },
  { key: 'corporate_gov',        label: 'حوكمة الشركات',                    regulator: 'وزارة التجارة / هيئة السوق المالية', mandatory: true },
  { key: 'aml_kyc',              label: 'مكافحة غسل الأموال / اعرف عميلك',  regulator: 'وحدة التحريات المالية',     mandatory: true },
  { key: 'consumer_protection',  label: 'حماية المستهلك',                   regulator: 'وزارة التجارة',             mandatory: true },
  // 10 سياقية
  { key: 'health_safety',        label: 'السلامة والصحة المهنية',           regulator: 'الموارد البشرية',           mandatory: false, sectors: ['manufacturing', 'construction', 'logistics', 'energy'] },
  { key: 'environment',          label: 'الالتزام البيئي',                  regulator: 'المركز الوطني للالتزام البيئي', mandatory: false, sectors: ['manufacturing', 'energy', 'construction'] },
  { key: 'food_safety',          label: 'سلامة الغذاء',                     regulator: 'هيئة الغذاء والدواء',       mandatory: false, sectors: ['food', 'restaurants', 'retail'] },
  { key: 'medical_devices',      label: 'الأجهزة الطبية',                   regulator: 'هيئة الغذاء والدواء',       mandatory: false, sectors: ['healthcare', 'medical'] },
  { key: 'pharma',               label: 'الأدوية ومستحضرات التجميل',        regulator: 'هيئة الغذاء والدواء',       mandatory: false, sectors: ['pharma', 'cosmetics'] },
  { key: 'banking_sama',         label: 'المصرفية والتمويل',                regulator: 'ساما',                     mandatory: false, sectors: ['banking', 'fintech', 'insurance'] },
  { key: 'capital_markets_cma',  label: 'سوق رأس المال',                    regulator: 'هيئة السوق المالية',        mandatory: false, sectors: ['investment', 'asset_mgmt'] },
  { key: 'telecom_cst',          label: 'الاتصالات وتقنية المعلومات',       regulator: 'هيئة الاتصالات',           mandatory: false, sectors: ['telecom', 'ict'] },
  { key: 'construction_safety',  label: 'الامتثال الإنشائي',                regulator: 'البلدية والإسكان',         mandatory: false, sectors: ['construction', 'real_estate'] },
  { key: 'export_import_customs',label: 'الجمارك والتجارة',                 regulator: 'جمارك زاتكا',              mandatory: false, sectors: ['trading', 'logistics', 'manufacturing'] },
];

// مولّد مختصر: لكل محور 8 أسئلة إلزامية × 8 محاور = 64.
const LIKERT: [string, string, string, string] = [
  'مفقود أو منتهي',
  'جزئي / غير منتظم',
  'موثّق ومطبّق',
  'مدقّق ومُحسّن',
];

function ax(axis: ComplianceAxisKey, i: number, prompt: string): ComplianceProQuestion {
  return {
    id: `${axis}_${i}`,
    axis,
    prompt,
    options: [
      { value: 'none', label: LIKERT[0], score: 0 },
      { value: 'partial', label: LIKERT[1], score: 1 },
      { value: 'good', label: LIKERT[2], score: 2 },
      { value: 'great', label: LIKERT[3], score: 3 },
    ],
  };
}

export interface ComplianceProQuestion {
  id: string;
  axis: ComplianceAxisKey;
  prompt: string;
  options: DeptQuestion['options'];
}

export const COMPLIANCE_PRO_QUESTIONS: ComplianceProQuestion[] = [
  // التراخيص التجارية (1–8)
  ax('commercial', 1, 'السجل التجاري ساري المفعول'),
  ax('commercial', 2, 'رخصة البلدية سارية'),
  ax('commercial', 3, 'تراخيص النشاط المتخصصة متوفرة'),
  ax('commercial', 4, 'عضوية الغرفة التجارية'),
  ax('commercial', 5, 'تسجيل العلامة التجارية / الملكية الفكرية'),
  ax('commercial', 6, 'ترخيص الاستثمار الأجنبي (مساس) عند الحاجة'),
  ax('commercial', 7, 'تسجيلات الفروع / المواقع المتعددة'),
  ax('commercial', 8, 'تقديم الإقرارات السنوية في موعدها'),
  // الضرائب والزكاة (1–8)
  ax('tax_zakat', 1, 'إقرارات الزكاة / ضريبة الدخل في موعدها'),
  ax('tax_zakat', 2, 'تسجيل ضريبة القيمة المضافة وإقراراتها الدورية'),
  ax('tax_zakat', 3, 'تكامل الفاتورة الإلكترونية (فاتورة)'),
  ax('tax_zakat', 4, 'الالتزام بضريبة الاستقطاع'),
  ax('tax_zakat', 5, 'توثيق أسعار التحويل'),
  ax('tax_zakat', 6, 'سجلات الخسائر الضريبية / السماحات الرأسمالية'),
  ax('tax_zakat', 7, 'تسجيل الضريبة الانتقائية عند الحاجة'),
  ax('tax_zakat', 8, 'ملف جاهزية التدقيق الضريبي'),
  // العمل والسعودة (1–8)
  ax('labor_saudization', 1, 'متابعة نطاق نطاقات واستهدافه'),
  ax('labor_saudization', 2, 'عقود قوى محدّثة'),
  ax('labor_saudization', 3, 'التكامل مع رواتب مدد'),
  ax('labor_saudization', 4, 'حماية الأجور (WPS)'),
  ax('labor_saudization', 5, 'تسجيلات ومدفوعات التأمينات (GOSI)'),
  ax('labor_saudization', 6, 'مخصّصات مكافأة نهاية الخدمة'),
  ax('labor_saudization', 7, 'تجديد رخص العمل والإقامات'),
  ax('labor_saudization', 8, 'تغطية التأمين الصحي (CCHI)'),
  // حماية البيانات (1–8)
  ax('data_privacy', 1, 'جرد بيانات PDPL مكتمل'),
  ax('data_privacy', 2, 'تعيين مسؤول حماية البيانات عند الحاجة'),
  ax('data_privacy', 3, 'سجل الأساس القانوني للمعالجة'),
  ax('data_privacy', 4, 'آليات الموافقة والإلغاء'),
  ax('data_privacy', 5, 'تقييمات النقل عبر الحدود'),
  ax('data_privacy', 6, 'عملية حقوق أصحاب البيانات'),
  ax('data_privacy', 7, 'عملية الإبلاغ عن الاختراق'),
  ax('data_privacy', 8, 'نشر إشعار الخصوصية'),
  // الأمن السيبراني (1–8)
  ax('cybersecurity', 1, 'تطبيق ضوابط ECC مع أدلّة'),
  ax('cybersecurity', 2, 'جرد وتصنيف الأصول'),
  ax('cybersecurity', 3, 'إدارة الوصول (أقل صلاحية ممكنة)'),
  ax('cybersecurity', 4, 'إدارة التحديثات والثغرات'),
  ax('cybersecurity', 5, 'اختبار خطة الاستجابة للحوادث'),
  ax('cybersecurity', 6, 'تنفيذ خطة النسخ الاحتياطي والتعافي'),
  ax('cybersecurity', 7, 'مراجعة مخاطر الأطراف الثالثة'),
  ax('cybersecurity', 8, 'تدريب توعوي لجميع الموظفين'),
  // حوكمة الشركات (1–8)
  ax('corporate_gov', 1, 'النظام الأساسي والتفويضات'),
  ax('corporate_gov', 2, 'محاضر اجتماعات المجلس / الشركاء'),
  ax('corporate_gov', 3, 'إقرارات تعارض المصالح'),
  ax('corporate_gov', 4, 'سياسة المعاملات مع الأطراف ذات العلاقة'),
  ax('corporate_gov', 5, 'قناة الإبلاغ عن المخالفات وحمايتها'),
  ax('corporate_gov', 6, 'توقيع ميثاق السلوك المهني'),
  ax('corporate_gov', 7, 'مراجعة سجل المخاطر فصلياً'),
  ax('corporate_gov', 8, 'وظيفة مراجعة داخلية أو ما يكافئها'),
  // مكافحة غسل الأموال (1–8)
  ax('aml_kyc', 1, 'توثيق سياسة مكافحة غسل الأموال'),
  ax('aml_kyc', 2, 'العناية الواجبة (KYC) عند الإدخال'),
  ax('aml_kyc', 3, 'فحص العقوبات / الأشخاص ذوي النفوذ'),
  ax('aml_kyc', 4, 'الإبلاغ عن المعاملات المشبوهة (STR)'),
  ax('aml_kyc', 5, 'سجل المستفيد الحقيقي (UBO)'),
  ax('aml_kyc', 6, 'تدريب AML سنوي'),
  ax('aml_kyc', 7, 'تدقيق AML مستقل'),
  ax('aml_kyc', 8, 'الاحتفاظ بالسجلات (5–10 سنوات)'),
  // حماية المستهلك (1–8)
  ax('consumer_protection', 1, 'نشر الشروط والأحكام بوضوح'),
  ax('consumer_protection', 2, 'سياسة الاسترداد / الإرجاع'),
  ax('consumer_protection', 3, 'تسويق صادق ومطابق'),
  ax('consumer_protection', 4, 'شفافية الأسعار (شاملة ضريبة القيمة المضافة)'),
  ax('consumer_protection', 5, 'الضمان ودعم ما بعد البيع'),
  ax('consumer_protection', 6, 'قناة معالجة الشكاوى'),
  ax('consumer_protection', 7, 'الإفصاح بالعربية حيث يلزم'),
  ax('consumer_protection', 8, 'الوصول الشامل / التصميم الدامج'),
];

// KO licenses — license dates that, when expired, force the axis score to 0.
export interface KOLicense {
  key: string;
  label: string;
  axis: ComplianceAxisKey;
  appliesWhen?: 'always' | 'sector';
  sectors?: string[];
}

export const KO_LICENSES: KOLicense[] = [
  { key: 'cr_expiry',         label: 'انتهاء السجل التجاري',                axis: 'commercial',       appliesWhen: 'always' },
  { key: 'baladi_expiry',     label: 'انتهاء رخصة البلدية',                 axis: 'commercial',       appliesWhen: 'always' },
  { key: 'vat_cert_expiry',   label: 'انتهاء شهادة ضريبة القيمة المضافة',   axis: 'tax_zakat',        appliesWhen: 'always' },
  { key: 'gosi_cert_expiry',  label: 'انتهاء شهادة التأمينات',              axis: 'labor_saudization',appliesWhen: 'always' },
  { key: 'cchi_expiry',       label: 'انتهاء التأمين الصحي (CCHI)',         axis: 'labor_saudization',appliesWhen: 'always' },
  { key: 'cybersec_cert',     label: 'انتهاء شهادة الأمن السيبراني',        axis: 'cybersecurity',    appliesWhen: 'sector', sectors: ['banking', 'fintech', 'telecom', 'ict'] },
];

export function activeAxesForSector(sector?: string): ComplianceAxisDef[] {
  const s = sector?.toLowerCase().trim();
  return COMPLIANCE_AXES.filter((a) => {
    if (a.mandatory) return true;
    if (!s || !a.sectors) return false;
    return a.sectors.includes(s);
  });
}
