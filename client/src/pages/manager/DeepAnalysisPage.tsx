import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { NextStepCard } from '@/components/strategic/NextStepCard'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import {
  DEPT_QUESTIONS,
  type CheckboxQuestion,
  type QuestionEntry,
  type RadioQuestion,
  type TextareaQuestion,
} from '@/lib/deptQuestions'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { MATURITY_BY_SPECIALTY } from '@/lib/maturityConfigs'
import { SalesDiagnostic } from './SalesDiagnostic'
import { MaturityInApp } from './MaturityInApp'
import { useAuthStore } from '@/store/authStore'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'

// ─── تصنيف نوع التحليل من عنوان القسم/معرّفه ──────────────────
// ٦ أنواع تحليل مختلفة يجمعها هذا البنك. المدير يفلتر بينها.
type AnalysisType = 'situational' | 'technical' | 'administrative' | 'financial' | 'challenges' | 'goals' | 'other'

const ANALYSIS_TYPE_META: Record<AnalysisType, { labelAr: string; icon: string; color: string; descAr: string }> = {
  situational:    { labelAr: 'الوضع الحالي',   icon: '📊', color: 'border-sky-300 bg-sky-50/50 text-sky-900',           descAr: 'تشخيص الحالة الراهنة — أين نحن اليوم.' },
  technical:      { labelAr: 'فنّي',            icon: '🧪', color: 'border-violet-300 bg-violet-50/50 text-violet-900',    descAr: 'الأنظمة والأدوات والعمليات التقنيّة.' },
  administrative: { labelAr: 'إداري',           icon: '🏛️', color: 'border-amber-300 bg-amber-50/50 text-amber-900',        descAr: 'الهيكل، الأدوار، الحوكمة، السياسات.' },
  financial:      { labelAr: 'مالي',            icon: '💰', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',  descAr: 'الميزانيات والتكاليف والعوائد.' },
  challenges:     { labelAr: 'تحدّيات',         icon: '⚠️', color: 'border-rose-300 bg-rose-50/50 text-rose-900',          descAr: 'المشاكل والعقبات والمخاطر.' },
  goals:          { labelAr: 'أهداف',           icon: '🎯', color: 'border-purple-300 bg-purple-50/50 text-purple-900',    descAr: 'المستقبل والطموحات والاتجاه.' },
  other:          { labelAr: 'عام',             icon: '📋', color: 'border-slate-300 bg-slate-50/50 text-slate-900',       descAr: '—' },
}

// ─── بنك أسئلة تكميليّة جاهزة — لكل تخصّص × كل نوع تحليل ──────
// المدير كان يحتاج يكتب الأسئلة يدوياً. الآن نقرة واحدة تُضيف سؤالاً
// جاهزاً من بنك مُعدّ خصّيصاً لتخصّصه، ويبقى خيار الكتابة الحرّة.
const DEPT_SUPPLEMENTARY_QUESTIONS: Record<DeptCode, Partial<Record<AnalysisType, string[]>>> = {
  HR: {
    situational: [
      'ما نسبة رضا الموظفين الحالي (eNPS) وما اتجاهه خلال العام؟',
      'كم يبلغ متوسط عمر الفريق ونسبة الاستقالات في آخر ٦ أشهر؟',
      'ما نسبة السعودة الفعليّة مقارنة بالمستهدف؟',
    ],
    technical: [
      'ما نظام HRIS الأساسي (SuccessFactors/Workday/Zoho People/Odoo/Excel)؟',
      'ما مستوى تكامل نظام الرواتب مع البنك للتحويلات الآليّة (Payroll Automation)؟',
      'هل يوجد نظام تقييم أداء رقمي متكامل (Performance Management)؟',
      'ما مستوى تبنّي نظام تتبّع المتقدّمين (ATS: Greenhouse/Lever/…)؟',
      'هل يوجد نظام إدارة تعلّم (LMS) لتدريب الموظفين؟',
      'ما نسبة العمليّات المؤتمَتة (توظيف/رواتب/إجازات) من الإجمالي؟',
      'ما دقّة بيانات الموظفين في السجلّات (٩٩٪+ / ٧٥-٩٩٪ / أقلّ)؟',
      'هل تُستخدم People Analytics أو Predictive HR في القرارات؟',
      'ما مستوى تكامل الأنظمة (HRIS ↔ ERP ↔ Payroll ↔ نظام الحضور)؟',
      'هل توجد بوّابة موظّف (Self-Service Portal) للطلبات والاستفسارات؟',
      'ما أدوات قياس الرضا والاستطلاعات (Culture Amp/Officevibe/…)؟',
      'هل يوجد نظام تتبّع OKR / KPIs للأفراد؟',
      'ما مستوى دمج AI في الفرز الوظيفي أو التنبّؤ بالدوران؟',
      'هل تُخزَّن بيانات الموظفين وفق PDPL (حماية بيانات شخصيّة)؟',
    ],
    administrative: [
      'هل يوجد مخطّط تنظيمي محدَّث ومعتمد ومنشور؟',
      'ما نسبة الوظائف التي لها وصف وظيفي معتمد؟',
      'هل يوجد دليل سياسات موارد بشريّة موثَّق ومحدَّث سنوياً؟',
      'كم عدد المستويات الإداريّة بين الموظف والرئيس التنفيذي؟',
    ],
    financial: [
      'ما تكلفة الدوران السنوي (Turnover Cost) كنسبة من إجمالي الرواتب؟',
      'ما متوسط تكلفة استقطاب موظف واحد بحسب المستوى؟',
      'ما نسبة الرواتب من إجمالي مصاريف الشركة؟',
      'ما ROI برامج التدريب المُنجَزة في العام الماضي؟',
    ],
    challenges: [
      'ما أكبر ٣ فجوات كفاءات في الفريق حالياً؟',
      'ما أهمّ سبب لاستقالة الكوادر المهمّة؟',
      'ما نسبة الشواغر المفتوحة أكثر من ٩٠ يوماً؟',
    ],
    goals: [
      'ما مستهدف eNPS للسنة القادمة وخطّة الوصول إليه؟',
      'ما الكفاءات الحرجة المطلوب بناؤها في العام القادم؟',
      'ما مستهدف نسبة السعودة وتاريخ التحقيق؟',
    ],
  },
  FINANCE: {
    situational: [
      'ما نسبة السيولة الحاليّة ودورات النقد الجاهزة؟',
      'ما هامش الربح الإجمالي وصافي الربح آخر ١٢ شهر؟',
      'ما DSO (فترة التحصيل) الحاليّة؟',
    ],
    technical: [
      'ما نظام المحاسبة والـ ERP المُستخدَم (Oracle/SAP/Odoo/Zoho Books/…)؟',
      'ما مستوى تكامل ERP مع أنظمة أخرى (HR/Sales/Inventory)؟',
      'هل التقارير الماليّة تُنتَج آلياً (Automated Financial Reporting)؟',
      'ما مستوى أتمتة إغلاق الشهر (Fast Close: ≤٥ أيام / ٥-١٠ / >١٠)؟',
      'هل توجد لوحة معلومات ماليّة حيّة (BI Dashboard: Power BI/Tableau)؟',
      'ما أداة إدارة المصاريف (Expensify/Zoho Expense/…)؟',
      'هل يوجد نظام إدارة الفواتير الإلكترونيّة متوافق مع ZATCA؟',
      'ما مستوى تبنّي التحصيل الآلي (Automated Collections)؟',
      'هل يُستخدَم نظام إدارة المخاطر الماليّة (GRC/Risk Register)؟',
      'ما مستوى استخدام AI في التنبّؤ المالي (Forecasting/Anomaly Detection)؟',
      'هل توجد نُسَخ احتياطيّة تلقائيّة للبيانات الماليّة مع اختبار استعادة دوري؟',
      'ما مستوى الأمن السيبراني للأنظمة الماليّة (Multi-Factor + Encryption)؟',
      'هل تُستخدَم منصّة CFO الحديثة (Dext/Digits/…) لتقارير أذكى؟',
    ],
    administrative: [
      'هل يوجد سياسة اعتمادات ماليّة (Approval Matrix) موثَّقة؟',
      'ما دورة الموازنة السنويّة ومدى الالتزام بها؟',
      'هل يوجد ميثاق تدقيق داخلي معتمد؟',
    ],
    financial: [
      'ما نسبة الديون قصيرة الأجل من إجمالي التزامات الشركة؟',
      'ما تكلفة رأس المال المرجّح (WACC)؟',
      'ما نسبة الإنفاق فوق الميزانية آخر ربع؟',
    ],
    challenges: [
      'ما أكبر مصادر الهدر الماليّ المكتشفة في آخر تدقيق؟',
      'ما نسبة الديون المشكوك في تحصيلها؟',
      'كم أشهر السيولة النقديّة المتاحة (Cash Runway)؟',
    ],
    goals: [
      'ما مستهدف الهامش الإجمالي للسنة القادمة؟',
      'ما خطّة تحسين DSO خلال ٦ أشهر؟',
      'هل هناك خطّة تمويل أو استحواذ استراتيجي؟',
    ],
  },
  SALES: {
    situational: [
      'ما معدّل نمو المبيعات YoY آخر ١٢ شهر؟',
      'ما تركّز الإيراد في العملاء (نسبة أعلى ٥ عملاء)؟',
      'ما نسبة الاحتفاظ بالعملاء الحاليّة؟',
    ],
    technical: [
      'ما CRM المُستخدَم (Salesforce/HubSpot/Zoho/…) ومدى تبنّي الفريق له (٪)؟',
      'هل توجد أتمتة تأهيل العملاء المحتمَلين (Lead Scoring)؟',
      'ما دقّة توقّعات المبيعات (Sales Forecast Accuracy)؟',
      'ما مستوى تكامل CRM مع Marketing + Support + Finance؟',
      'ما أداة تمكين المبيعات (Sales Enablement: Highspot/Seismic/…)؟',
      'هل يوجد نظام تسجيل مكالمات وتحليلها بالـ AI (Gong/Chorus)؟',
      'ما مستوى استخدام Sales Playbook رقمي (نصوص/قوالب/عروض جاهزة)؟',
      'ما أدوات جدولة الاجتماعات مع العملاء (Calendly/HubSpot Meetings)؟',
      'هل تُستخدَم أدوات توقيع رقمي (DocuSign/PandaDoc/…)؟',
      'ما مستوى استخدام Data Enrichment (Apollo/ZoomInfo/…)؟',
      'هل يوجد نظام إدارة عمولات ومكافآت رقمي (Xactly/Everstage)؟',
    ],
    administrative: [
      'هل توجد Playbook مبيعات موثَّقة لكل مرحلة بيع؟',
      'كم نسبة فريق المبيعات المُعتمَد بشهادات مهنيّة؟',
      'هل توجد مصفوفة عمولات وحوافز واضحة ومنشورة؟',
    ],
    // 💰 أسئلة ذكيّة تكشف القوّة الماليّة للمبيعات وفرص تحسينها.
    financial: [
      'ما CAC (تكلفة اكتساب العميل) الحاليّة واتجاهها؟',
      'ما LTV (قيمة العميل مدى الحياة) ونسبة LTV/CAC؟ (الصحّي ٣:١+)',
      'ما متوسط قيمة الصفقة (AOV) وقيمة الاشتراك الشهري (MRR)؟',
      'ما هامش الربح على المبيعات (Gross Margin) واتجاهه؟',
      'ما نسبة التخفيضات الممنوحة من إجمالي المبيعات (Discount Leakage)؟',
      'ما نسبة تحقيق الحصص البيعيّة (Quota Attainment) للفريق؟',
      'ما تغطية خطّ الأنابيب مقارنةً بالهدف (Pipeline Coverage ×)؟',
      'ما نسبة الإيراد المتوقَّع/المتكرّر (Predictable Revenue) من الإجمالي؟',
      'ما تكلفة المبيعات كنسبة من الإيراد (Cost of Sales %)؟',
    ],
    challenges: [
      'ما أطول مرحلة تعطّل صفقات المبيعات؟',
      'ما أكبر أسباب فقد الصفقات (Win/Loss Analysis)؟',
      'ما نسبة معدّل التخبّط الشهري (Monthly Churn)؟',
    ],
    goals: [
      'ما مستهدف نمو المبيعات للسنة القادمة؟',
      'ما القنوات الجديدة المخطَّط دخولها؟',
      'ما شرائح العملاء الجديدة المستهدفة؟',
    ],
  },
  MARKETING: {
    situational: [
      'ما نسبة الوعي بالعلامة في الجمهور المستهدف؟',
      'ما مصادر حركة الزوّار الحاليّة على الموقع/المتجر؟',
      'ما ROMI الحالي (العائد على الإنفاق التسويقي)؟',
    ],
    // 🎯 هذه الأسئلة تغطّي كامل محتوى «مركز التسويق» — دمج بدل صفحة منفصلة.
    technical: [
      '🎨 هويّة العلامة: ما رابط الشعار الرسمي المُعتمَد وهل هو محدَّث؟',
      '🎨 ما اسم العلامة الرسمي + الشعار النصّي (Slogan) بالعربيّة والإنجليزيّة؟',
      '🌐 ما رابط الموقع الإلكتروني الرسمي؟ وما مؤشّرات أدائه (Lighthouse Score)؟',
      '🛒 ما رابط المتجر الإلكتروني ومنصّته (Salla/Zid/Shopify/WooCommerce/Custom)؟',
      '📱 X (Twitter): ما اسم الحساب الرسمي + عدد المتابعين + معدّل التفاعل؟',
      '📱 Instagram: ما اسم الحساب + عدد المتابعين + Engagement Rate؟',
      '📱 TikTok: ما اسم الحساب + معدّل مشاهدات الفيديوهات؟',
      '📱 LinkedIn: ما رابط الشركة + عدد المتابعين (للـ B2B)؟',
      '📱 YouTube: ما رابط القناة + عدد المشتركين + متوسط المشاهدات؟',
      '📱 Snapchat + Facebook: ما الحسابات النشطة والوصول الشهري؟',
      '📊 GA4: هل مُنصَّب ومُهيَّأ؟ وما أهمّ ٣ أهداف تُقاس فيه؟',
      '📊 Search Console: ما متوسّط CTR + Position + Impressions؟',
      '📊 أداة SEO (Ahrefs/SEMrush/Moz): ما Domain Rating الحالي؟',
      '🧰 نظام Marketing Automation: ما الأداة المُستخدَمة (HubSpot/Marketo/…)؟',
      '🧰 نظام CRM: ما المستخدَم ومدى تكامله مع نظام التسويق؟',
      '💰 ROMI بالقناة: كم عائد كل ريال منفَق على Meta/Google/TikTok/Snap؟',
      '💰 CAC بالقناة: ما تكلفة اكتساب عميل من كل قناة رئيسيّة؟',
      '💰 LTV/CAC ratio: هل ≥ ٣× (صحّي)؟ وما اتّجاهه؟',
      '💰 CVR: ما معدّل التحويل من الزيارة إلى الشراء/التسجيل؟',
      '💰 CPM/CPC: ما متوسّط تكلفة الظهور والنقر بالقناة؟',
      '📝 استراتيجيّة المحتوى: ما Content Pillars الـ ٣-٥ الرئيسيّة؟',
      '📅 جدول النشر: كم منشور أسبوعياً في كل قناة + من المسؤول؟',
      '🤖 مستوى استخدام AI في المحتوى (ChatGPT/Midjourney/…)؟',
      '👥 حجم الجمهور المستهدَف (Persona) وخصائصه الديموغرافيّة؟',
    ],
    administrative: [
      'هل يوجد Brand Book موحَّد ومحدَّث؟',
      'ما هيكل فريق التسويق ومسؤوليّاته (Internal/Agency/Hybrid)؟',
      'ما دورة اعتماد الحملات (Approval Workflow)؟',
    ],
    financial: [
      'ما نسبة إنفاق الميزانية بين قنوات مدفوعة/عضويّة/شراكات؟',
      'ما CAC حسب القناة؟',
      'ما تكلفة الوصول الألف (CPM) وتكلفة النقرة (CPC) الحاليّة؟',
    ],
    challenges: [
      'ما أكبر ٣ قنوات تفقد الأداء أو ترتفع تكلفتها؟',
      'هل توجد فجوة بين رسائل التسويق والمنتج/الخدمة الفعليّة؟',
      'ما نسبة تراجع التفاعل الاجتماعي في آخر ٦ أشهر؟',
    ],
    goals: [
      'ما مستهدف الوعي بالعلامة للعام القادم؟',
      'ما القنوات الجديدة المخطَّط اختبارها؟',
      'هل هناك خطّة إعادة إطلاق للعلامة (Rebrand)؟',
    ],
  },
  OPERATIONS: {
    situational: [
      'ما OEE الحالي (كفاءة المعدّات الشاملة)؟',
      'ما نسبة التسليم في الوقت (On-Time Delivery)؟',
      'ما نسبة الفاقد (Waste) الحاليّة؟',
    ],
    technical: [
      'ما أنظمة ERP/MES المُستخدَمة (SAP/Oracle/Odoo)؟',
      'ما مستوى الأتمتة في خطوط الإنتاج (٪ Automation)؟',
      'هل تُستخدَم صيانة تنبّؤيّة (Predictive Maintenance) بأدوات AI/IoT؟',
      'ما نظام إدارة المخزون (Inventory Management System)؟',
      'ما مستوى تبنّي إنترنت الأشياء (IoT) في مراقبة المعدّات؟',
      'هل يوجد نظام إدارة سلسلة الإمداد (SCM: SAP Ariba/Coupa)؟',
      'ما أدوات تخطيط الطاقة الإنتاجيّة (Capacity Planning)؟',
      'ما مستوى استخدام Digital Twin أو المحاكاة (Simulation)؟',
      'هل يوجد نظام إدارة الجودة الرقمي (QMS: MasterControl/…)؟',
      'ما أدوات التتبّع الحيّ للإنتاج (MES Dashboards)؟',
      'ما مستوى تكامل ERP مع WMS/TMS للتوزيع؟',
    ],
    administrative: [
      'هل توجد SOPs موثَّقة لكل عمليّة رئيسيّة؟',
      'ما مستوى تطبيق Lean/Six Sigma في الفريق؟',
      'هل يوجد نظام إدارة الجودة (QMS) معتمد؟',
    ],
    financial: [
      'ما تكلفة الوحدة المُنتَجة (Cost per Unit)؟',
      'ما نسبة تكلفة الجودة الرديئة (COPQ)؟',
      'ما دوران المخزون السنوي (Inventory Turnover)؟',
    ],
    challenges: [
      'ما أكبر اختناقات (Bottlenecks) في خطوط الإنتاج؟',
      'ما نسبة العمل تحت الطاقة القصوى؟',
      'ما تكرار توقّفات الإنتاج غير المخطَّطة؟',
    ],
    goals: [
      'ما مستهدف OEE للعام القادم؟',
      'ما خطّة تحسين سلسلة الإمداد؟',
      'هل هناك خطّة توسّع في القدرة الإنتاجيّة؟',
    ],
  },
  IT: {
    situational: [
      'ما Uptime الحالي للأنظمة الحرجة؟',
      'ما متوسط زمن حلّ الحوادث (MTTR)؟',
      'ما عدد الحوادث السيبرانيّة في آخر ١٢ شهر؟',
    ],
    technical: [
      'ما نسبة الاعتماد على السحابة (AWS/Azure/GCP) مقابل on-prem؟',
      'هل توجد استراتيجيّة Zero Trust مُطبَّقة (بلا شبكة موثوقة افتراضياً)؟',
      'ما مستوى تبنّي DevOps/CI-CD في فرق التطوير؟',
      'هل توجد نُسَخ احتياطيّة تلقائيّة مع اختبار استعادة دوري (Disaster Recovery)؟',
      'ما نظام إدارة الهويّة (Identity: Okta/Azure AD)؟',
      'ما نظام SIEM المُستخدَم (Splunk/Sentinel/Wazuh)؟',
      'ما نظام تذاكر IT (ServiceNow/Jira Service Management)؟',
      'ما مستوى تبنّي Infrastructure as Code (Terraform/Pulumi)؟',
      'هل توجد استراتيجيّة Multi-Cloud أو Hybrid Cloud؟',
      'ما نظام المراقبة الشامل (Datadog/New Relic/Grafana)؟',
      'ما نظام إدارة الأصول (CMDB) ومدى دقّته؟',
      'ما مستوى تبنّي Container/Kubernetes للأحمال؟',
      'هل يوجد اختبار اختراق (Pen Test) دوري ونتائجه؟',
      'ما مستوى دمج AI في تشغيل IT (AIOps)؟',
    ],
    administrative: [
      'هل يوجد سجلّ أصول IT محدَّث (CMDB)؟',
      'ما مستوى تبنّي ITIL/COBIT في الفريق؟',
      'هل توجد سياسة PDPL/GDPR مطبَّقة وموثَّقة؟',
    ],
    financial: [
      'ما تكلفة IT لكل موظف؟',
      'ما ROI مشاريع الأتمتة المُنجَزة؟',
      'ما نسبة الميزانيّة على البنية التحتيّة vs التطوير؟',
    ],
    challenges: [
      'ما أكبر الأنظمة القديمة (Legacy) التي تحتاج تحديثاً؟',
      'ما فجوة المهارات الحرجة في فريق التقنية؟',
      'ما أهمّ نقاط الضعف السيبرانيّة المكتشفة؟',
    ],
    goals: [
      'ما خطّة الترحيل إلى السحابة خلال ٣ سنوات؟',
      'ما استراتيجيّة الذكاء الاصطناعي في التطبيقات؟',
      'ما شهادات الأمن السيبراني المستهدَفة؟',
    ],
  },
  CUSTOMER_SERVICE: {
    situational: [
      'ما CSAT الحالي واتجاهه؟',
      'ما NPS الحالي؟',
      'ما زمن الاستجابة الأوّل (First Response Time)؟',
    ],
    technical: [
      'ما نظام Help Desk المُستخدَم (Zendesk/Freshdesk/Intercom/…)؟',
      'ما مستوى تبنّي روبوت المحادثة (Chatbot) بذكاء اصطناعي؟',
      'هل توجد قاعدة معرفة ذاتيّة (Self-Service Knowledge Base) للعملاء؟',
      'ما القنوات المدعومة (Live Chat/WhatsApp/Instagram DM/Email/Phone)؟',
      'ما نظام تسجيل المكالمات وتحليلها (Call Analytics)؟',
      'ما أداة قياس رضا العميل (Delighted/Qualtrics/…)؟',
      'ما مستوى تكامل الدعم مع CRM ومع نظام الطلبات؟',
      'هل يوجد Voice of Customer Program منهجي؟',
      'ما مستوى استخدام Sentiment Analysis على الشكاوى؟',
      'هل يوجد Screen Sharing / Co-Browsing للمساعدة الحيّة؟',
    ],
    administrative: [
      'هل توجد SLAs موثَّقة ومنشورة للعملاء؟',
      'ما نسبة الوكلاء المُعتمَدين بشهادات دعم؟',
      'هل يوجد سياسة تصعيد واضحة للحالات المعقّدة؟',
    ],
    financial: [
      'ما تكلفة كل تذكرة دعم؟',
      'ما نسبة الاسترجاعات/المطالبات وأثرها المالي؟',
    ],
    challenges: [
      'ما أكبر أسباب شكاوى العملاء المتكرّرة؟',
      'ما نسبة الوكلاء الذين يستقيلون في السنة الأولى؟',
      'ما نسبة التصعيد إلى المستويات الأعلى؟',
    ],
    goals: [
      'ما مستهدف CSAT/NPS للسنة القادمة؟',
      'ما خطّة تقليل زمن الحلّ إلى النصف؟',
    ],
  },
  SUPPORT: {
    situational: [
      'ما SLA compliance الحالي؟',
      'ما FCR (Fixed on First Contact) الحالي؟',
    ],
    technical: [
      'ما نظام الدعم الفنّي والمراقبة المُستخدَم؟',
      'هل يوجد نظام تحليل لسجلّات الدعم (Log Analytics)؟',
      'ما مستوى تبنّي التحكّم عن بُعد وحلّ آلي؟',
    ],
    administrative: [
      'هل توجد قاعدة معرفة داخليّة للمهندسين؟',
      'ما مستوى تصنيف مستويات الدعم (L1/L2/L3)؟',
    ],
    financial: [
      'ما تكلفة الدعم لكل عميل؟',
      'ما ROI برامج SLA المؤسسي المدفوع؟',
    ],
    challenges: [
      'ما نسبة تصعيد التذاكر إلى L2/L3؟',
      'ما نسبة تكرار المشاكل نفسها؟',
    ],
    goals: [
      'ما مستهدف MTTR للسنة القادمة؟',
      'ما استراتيجيّة الدعم الاستباقي (Proactive Support)؟',
    ],
  },
  LOGISTICS: {
    situational: [
      'ما نسبة التسليم في الوقت والدقّة (OTIF)؟',
      'ما تكلفة الشحن لكل طلب؟',
    ],
    technical: [
      'ما نظام WMS/TMS المُستخدَم؟',
      'ما مستوى تتبّع الشحنات في الوقت الحقيقي؟',
      'هل تُستخدَم أدوات تحسين مسارات (Route Optimization)؟',
    ],
    administrative: [
      'هل توجد سياسات سلامة سائقين موثَّقة؟',
      'ما مستوى الالتزام باللوائح البلديّة/الجمركيّة؟',
    ],
    financial: [
      'ما دوران المخزون السنوي؟',
      'ما تكاليف التخزين لكل يوم/متر مكعّب؟',
      'ما نسبة تكاليف الوقود من إجمالي تكلفة الشحن؟',
    ],
    challenges: [
      'ما أكبر أسباب تأخيرات التسليم؟',
      'ما نسبة الشحنات التي تصل بأضرار؟',
    ],
    goals: [
      'ما خطّة توسّع شبكة التوزيع؟',
      'ما استهداف خفض تكاليف الشحن؟',
    ],
  },
  QUALITY: {
    situational: [
      'ما معدّل العيوب (Defect Rate) الحاليّة؟',
      'ما نسبة المنتجات التي تجتاز الفحص من أوّل مرّة؟',
    ],
    technical: [
      'هل تُستخدَم أدوات فحص آليّة/AI في الجودة؟',
      'ما مستوى تطبيق SPC (Statistical Process Control)؟',
    ],
    administrative: [
      'هل توجد شهادات ISO 9001 ساريّة؟',
      'ما مستوى تدريب فريق الجودة على Six Sigma؟',
      'هل يوجد نظام إدارة الشكاوى (CAPA)؟',
    ],
    financial: [
      'ما تكلفة الجودة الرديئة (COPQ) كنسبة من الإيراد؟',
      'ما تكاليف إعادة العمل والاسترجاعات؟',
    ],
    challenges: [
      'ما أكبر ٣ أسباب رئيسيّة لعيوب الإنتاج؟',
      'ما نسبة الشكاوى القادمة من العملاء؟',
    ],
    goals: [
      'ما مستهدف تخفيض معدّل العيوب؟',
      'ما شهادات الجودة الجديدة المستهدَفة؟',
    ],
  },
  PROJECTS: {
    situational: [
      'ما نسبة إنجاز المشاريع في الموعد؟',
      'ما نسبة إنجاز المشاريع ضمن الميزانيّة؟',
    ],
    technical: [
      'ما أدوات إدارة المشاريع (Jira/MSProject/Asana)؟',
      'ما مستوى تبنّي Agile/Scrum في الفرق؟',
    ],
    administrative: [
      'هل يوجد PMO فاعل بحوكمة موثَّقة؟',
      'ما نسبة مدراء المشاريع الحاصلين على PMP/PRINCE2؟',
      'هل توجد قوالب مشاريع موحّدة؟',
    ],
    financial: [
      'ما CPI (Cost Performance Index) المتوسّط؟',
      'ما نسبة تجاوز الميزانيّة في آخر ١٠ مشاريع؟',
    ],
    challenges: [
      'ما أكبر أسباب Scope Creep؟',
      'ما نسبة المشاريع المتعثّرة أو المُلغاة؟',
    ],
    goals: [
      'ما مستهدف On-Time Delivery للسنة القادمة؟',
      'ما خطّة اعتماد ذكاء اصطناعي في إدارة المشاريع؟',
    ],
  },
  COMPLIANCE: {
    situational: [
      'ما عدد ملاحظات الجهات الرقابيّة في آخر ١٢ شهر؟',
      'ما نسبة اجتياز التدقيقات الخارجيّة؟',
    ],
    technical: [
      'هل تُستخدَم أداة GRC متكاملة؟',
      'ما مستوى أتمتة فحص الامتثال؟',
    ],
    administrative: [
      'هل توجد سياسات امتثال موثَّقة ومحدَّثة سنوياً؟',
      'ما نسبة الفريق الحاصل على شهادات مهنيّة (CCEP)؟',
    ],
    financial: [
      'ما تكلفة الغرامات المدفوعة السنويّة؟',
      'ما ROI برنامج الامتثال (تجنّب الغرامات)؟',
    ],
    challenges: [
      'ما أكبر مخاطر عدم الامتثال المكتشفة؟',
      'ما نسبة التغيّرات التنظيميّة التي لم تُغطَّ بعد؟',
    ],
    goals: [
      'ما شهادات الامتثال الجديدة المستهدَفة؟',
      'ما خطّة رفع وعي الموظفين بالامتثال؟',
    ],
  },
  GOVERNANCE: {
    situational: [
      'ما نسبة حضور اجتماعات مجلس الإدارة؟',
      'ما نسبة تنفيذ قرارات المجلس في مواعيدها؟',
    ],
    technical: [
      'هل توجد بوّابة إلكترونيّة لاجتماعات المجلس؟',
      'ما مستوى استخدام أدوات تقييم أعضاء المجلس؟',
    ],
    administrative: [
      'هل يوجد ميثاق حوكمة معتمد ومحدَّث؟',
      'ما نسبة الأعضاء المستقلّين في المجلس؟',
    ],
    financial: [
      'ما تكلفة أتعاب أعضاء المجلس واستشاراته؟',
    ],
    challenges: [
      'ما أكبر النزاعات الحوكميّة الأخيرة؟',
      'ما فجوة الشفافيّة في الإفصاح؟',
    ],
    goals: [
      'ما مستهدف رفع تقييم فعاليّة المجلس؟',
      'ما خطّة تنويع تخصّصات الأعضاء؟',
    ],
  },
}

// ─── تصنيف السؤال (لا القسم) إلى ٣ فئات فقط: فنّي · مالي · إداري ─────
// طلب المستخدم: «التحليل العميق يكون إداري ومالي وفني» — بلا وضع/تحدّيات/
// أهداف. والتصنيف على مستوى **السؤال** (لا القسم) حتى لا تتداخل الأسئلة:
// كل سؤال يذهب لفئته حسب نصّه، فتُجمَع كل الأسئلة الماليّة معاً، والفنّية معاً…
//
// الترتيب: فنّي (نظام/أداة صريحة) ثم مالي (مال/تكلفة/إيراد) ثم إداري (الباقي —
// البنية والسياسات والأدوار والفريق والأهداف كلّها تنظيم = إداري).
const TECH_RE = /(نظام|أنظمة|أداة|أدوات|تقنية|تقني|رقمي|رقمنة|أتمتة|مؤتمت|آلي|برمج|منصّة|منصة|تطبيق|موقع الكترون|متجر الكترون|تكامل|قاعدة بيانات|لوحة معلومات|ذكاء اصطناعي|سيبراني|نسخ احتياطي|crm|erp|hris|lms|\bats\b|\bapi\b|dashboard|\bai\b|\bbi\b|automation|digital|platform|software|backup|integration|saas|cloud)/
const FIN_RE = /(مالي|ميزاني|تكلف|كلفة|تكاليف|راتب|رواتب|أجور|إيراد|أرباح|ربحيّ|ربحية|هامش|نقدي|سيول|رأس المال|رأسمال|ضريب|زكاة|عمول|تسعير|أسعار|السعر|خصم|مصروف|موازنة|تدفّق نقدي|تحصيل|ائتمان|فاتور|cac|ltv|mrr|aov|\broi\b|romi|wacc|financial|budget|\bcost\b|revenue|margin|payroll|salary|discount|profit)/

function classifyQuestion(label: string): 'technical' | 'financial' | 'administrative' {
  const t = (label ?? '').toLowerCase()
  if (TECH_RE.test(t)) return 'technical'
  if (FIN_RE.test(t)) return 'financial'
  return 'administrative'
}

// الفئات الثلاث المعروضة (بالترتيب) — إداري ثم مالي ثم فنّي.
const DEEP_TYPES: AnalysisType[] = ['administrative', 'financial', 'technical']

// ─── A1 — التحليل العميق المخصّص للتخصّص ──────────────────────────────────────
// المسار: /manager/deep-analysis (يقرأ ?client=<id> عبر hook مشترك).
// يستهلك DEPT_QUESTIONS[specialty] من بنك stratix القديم (٦ أقسام × ~٥٠ سؤالاً
// لـ HR حالياً؛ باقي التخصّصات تُنقل تدريجياً في commits لاحقة).
//
// شكل التخزين: StrategicArtifact بنوع 'DEPT_DEEP_FULL' مستقلّ عن
// 'DEPT_DEEP_ANSWERS' القديم (٤ أسئلة عامة) حتى لا تتداخل مسودّتان.
// شكل البيانات: { deptCode, answers: { [questionId]: string | string[] } }.

type QAValue = string | string[]

// أسئلة مخصّصة يضيفها المدير لتعميق نوع تحليل معيّن.
interface CustomQuestion {
  id: string
  type: AnalysisType
  label: string
  answer: string
}

interface DeepFullData {
  deptCode: DeptCode
  answers: Record<string, QAValue>
  // أسئلة مخصّصة اختياريّة — تعمّق التحليل حيث المدير يحتاج.
  customQuestions?: CustomQuestion[]
}

function ensureQAValue(v: unknown): QAValue | null {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[]
  return null
}

function normalize(raw: unknown): Record<string, QAValue> {
  const out: Record<string, QAValue> = {}
  if (!raw || typeof raw !== 'object' || !('answers' in raw)) return out
  const a = (raw as DeepFullData).answers
  if (!a || typeof a !== 'object') return out
  for (const [k, v] of Object.entries(a)) {
    const value = ensureQAValue(v)
    if (value != null) out[k] = value
  }
  return out
}

// embedded=true عند تضمينها داخل DeptDeepPage — نُخفي بطاقة «الخطوة التالية»
// تفادياً لتكرارها (الحاوية تعرض بطاقتها الخاصّة).
// ─── موجّه: المبيعات → تشخيص تكيّفي؛ غيرها → البنك الحالي (٣ فئات) ───
// نقطة تبديل واحدة تغطّي المسار والتضمين معاً (المرحلة ٥ من تشخيص المبيعات).
export function DeepAnalysisPage({ embedded = false }: { embedded?: boolean } = {}) {
  const specialty = useAuthStore((s) => s.user?.specialtyDeptType ?? null)
  if (specialty === 'SALES') return <SalesDiagnostic embedded={embedded} />
  const maturityConfig = specialty ? MATURITY_BY_SPECIALTY[specialty] : undefined
  if (maturityConfig) return <MaturityInApp config={maturityConfig} embedded={embedded} />
  return <DeepAnalysisBank embedded={embedded} />
}

function DeepAnalysisBank({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useAuthStore((s) => s.user)
  const [sp] = useSearchParams()
  const clientQuery = sp.get('client') ? `?client=${sp.get('client')}` : ''
  const scope = useClientScopedCompany()
  const company = scope.company
  const specialty = (user?.specialtyDeptType ?? null) as DeptCode | null
  const bank = specialty ? DEPT_QUESTIONS[specialty] ?? null : null

  const [answers, setAnswers] = useState<Record<string, QAValue>>({})
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // فلتر نوع التحليل — null = عرض الكلّ.
  const [typeFilter, setTypeFilter] = useState<AnalysisType | null>(null)
  // نموذج إضافة سؤال مخصّص (يظهر لكل نوع عند الضغط).
  const [addingForType, setAddingForType] = useState<AnalysisType | null>(null)
  const [newQuestionText, setNewQuestionText] = useState('')
  // R6-fix — حفظ آلي: البنك ٦٠ سؤالاً على ٦ أقسام؛ المدير قد يجيب جزءاً
  // ثم يغلق. هذا يمنع فقد التقدّم. status = idle → saving → saved | error.
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextAutosave = useRef(true) // نتخطّى التشغيل الأوّل بعد تحميل الإجابات

  // نجمّع الأسئلة في ٣ فئات (إداري/مالي/فنّي) على مستوى **السؤال** — لا القسم —
  // حتى لا تتداخل الأنواع: كل سؤال يذهب لفئته الصحيحة حسب نصّه.
  const grouped = useMemo(() => {
    if (!bank) return []
    const map = new Map<AnalysisType, { type: AnalysisType; questions: QuestionEntry[] }>()
    for (const t of DEEP_TYPES) map.set(t, { type: t, questions: [] })
    for (const q of bank.questions) {
      map.get(classifyQuestion(q.label))!.questions.push(q)
    }
    return DEEP_TYPES.map((t) => map.get(t)!).filter((g) => g.questions.length > 0)
  }, [bank])

  // إحصائيات لكل نوع تحليل (لبناء الفلاتر مع عدّاد). تشمل الأسئلة المخصّصة.
  const typeStats = useMemo(() => {
    const stats: Record<AnalysisType, { total: number; answered: number; fromBank: number; custom: number }> = {
      situational:    { total: 0, answered: 0, fromBank: 0, custom: 0 },
      technical:      { total: 0, answered: 0, fromBank: 0, custom: 0 },
      administrative: { total: 0, answered: 0, fromBank: 0, custom: 0 },
      financial:      { total: 0, answered: 0, fromBank: 0, custom: 0 },
      challenges:     { total: 0, answered: 0, fromBank: 0, custom: 0 },
      goals:          { total: 0, answered: 0, fromBank: 0, custom: 0 },
      other:          { total: 0, answered: 0, fromBank: 0, custom: 0 },
    }
    for (const g of grouped) {
      stats[g.type].total += g.questions.length
      stats[g.type].fromBank += g.questions.length
      stats[g.type].answered += g.questions.filter((q) => answers[q.id] != null).length
    }
    for (const cq of customQuestions) {
      stats[cq.type].total++
      stats[cq.type].custom++
      if (cq.answer.trim()) stats[cq.type].answered++
    }
    return stats
  }, [grouped, answers, customQuestions])

  // اكتشاف عدم التوازن — نوع فيه أكثر من ضعف متوسّط الأنواع الأخرى.
  const balanceHint = useMemo(() => {
    const nonEmpty = Object.entries(typeStats).filter(([t, s]) => t !== 'other' && s.fromBank > 0) as [AnalysisType, typeof typeStats[AnalysisType]][]
    if (nonEmpty.length < 2) return null
    const counts = nonEmpty.map(([, s]) => s.fromBank)
    const max = Math.max(...counts)
    const min = Math.min(...counts)
    if (max - min < 3) return null
    const maxType = nonEmpty.find(([, s]) => s.fromBank === max)?.[0]
    const minType = nonEmpty.find(([, s]) => s.fromBank === min)?.[0]
    if (!maxType || !minType) return null
    return { maxType, min, max, minType, diff: max - min }
  }, [typeStats])

  function addCustomQuestion(type: AnalysisType, label: string) {
    const t = label.trim()
    if (!t) return
    setCustomQuestions((prev) => [...prev, { id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, label: t, answer: '' }])
    setNewQuestionText('')
    setAddingForType(null)
    toast.success(`أُضيف سؤال مخصّص في «${ANALYSIS_TYPE_META[type].labelAr}» — أجب عليه في نهاية الصفحة.`)
  }
  function updateCustomAnswer(id: string, answer: string) {
    setCustomQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answer } : q)))
  }
  function removeCustom(id: string) {
    if (!confirm('حذف هذا السؤال المخصّص؟')) return
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  // القائمة المفلترة (بحسب نوع التحليل المُختار).
  const visibleGrouped = useMemo(() => {
    if (!typeFilter) return grouped
    return grouped.filter((g) => g.type === typeFilter)
  }, [grouped, typeFilter])

  useEffect(() => {
    if (!company || !specialty || !bank) return
    let cancel = false
    setLoading(true)
    setAnswers({})
    setSavedAt(null)
    skipNextAutosave.current = true // نتخطّى الحفظ الآلي على القراءة الأولى
    ;(async () => {
      try {
        const artifact = await getArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL')
        if (cancel) return
        if (artifact && artifact.data && (artifact.data as DeepFullData).deptCode === specialty) {
          setAnswers(normalize(artifact.data))
          const cq = (artifact.data as DeepFullData).customQuestions
          if (Array.isArray(cq)) setCustomQuestions(cq)
          setSavedAt(artifact.updatedAt)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل إجاباتك السابقة'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [company, specialty, bank])

  const answered = Object.keys(answers).length
  const total = bank?.questions.length ?? 0
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0

  // ─── R6-fix — حفظ آلي بعد 1200ms من آخر تعديل ──────────────────
  // البنك طويل ومتشعّب (٦٠+ سؤالاً على ٦ أقسام). المدير قد يجيب جزءاً ثم يغادر
  // — الحفظ الآلي يحمي التقدّم دون فعل يدوي. زر «حفظ الآن» يبقى موجوداً كضمانة.
  useEffect(() => {
    if (!company || !specialty || loading) return
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      setAutosaveStatus('saving')
      try {
        const payload: DeepFullData = { deptCode: specialty, answers, customQuestions }
        const saved = await upsertArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL', payload)
        setSavedAt(saved.updatedAt)
        setAutosaveStatus('saved')
      } catch {
        setAutosaveStatus('error')
      }
    }, 1200)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [answers, customQuestions, company, specialty, loading])

  async function save() {
    if (!company || !specialty) return
    // نسمح بحفظ 0 إجابات (لمسح مسودّة قديمة). لا toast خطأ للحفظ اليدوي عند 0.
    setSaving(true)
    setAutosaveStatus('saving')
    try {
      const payload: DeepFullData = { deptCode: specialty, answers, customQuestions }
      const saved = await upsertArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL', payload)
      setSavedAt(saved.updatedAt)
      setAutosaveStatus('saved')
      toast.success(`تم حفظ ${answered} إجابة في القاعدة`)
    } catch (err) {
      setAutosaveStatus('error')
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function setRadio(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function toggleCheckbox(id: string, value: string) {
    setAnswers((prev) => {
      const current = prev[id]
      const arr = Array.isArray(current) ? current : []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      if (next.length === 0) {
        const { [id]: _drop, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }

  function setText(id: string, value: string) {
    if (value.trim().length === 0) {
      setAnswers((prev) => {
        const { [id]: _drop, ...rest } = prev
        return rest
      })
      return
    }
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  // ─── حالات الفشل ─────────────────────────────────────────────────────
  if (!specialty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التحليل العميق" />
        <EmptyState
          title="لا يوجد تخصّص محدّد على حسابك"
          description="حدّث تخصّصك من إعدادات الحساب لعرض بنك الأسئلة العميقة."
        />
      </div>
    )
  }

  if (!bank) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`التحليل العميق — ${DEPT_LABEL[specialty]}`}
          description="سؤال ٦٠ تقريباً على ٦ أقسام."
        />
        <EmptyState
          icon={<span className="text-4xl">🚧</span>}
          title={`بنك الأسئلة العميقة لإدارة ${DEPT_LABEL[specialty]} قيد الإعداد`}
          description="يمكنك حالياً استخدام «التحليل العميق» المبسّط بأربعة أسئلة."
          action={
            <Link
              to="/manager/dept-deep"
              className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              فتح التحليل المبسّط
            </Link>
          }
        />
      </div>
    )
  }

  if (scope.loading) return <LoadingSpinner fullPage label="جاري تحميل الشركة…" />

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`التحليل العميق — ${DEPT_LABEL[specialty]}`} />
        <EmptyState
          title={scope.error ?? 'لا توجد شركة مرتبطة بحسابك'}
          description="عُد إلى «عملائي» واختر عميلاً قبل بدء التحليل."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`التحليل العميق — ${DEPT_LABEL[specialty]}`}
        description={
          savedAt
            ? `آخر حفظ: ${new Date(savedAt).toLocaleString('ar-SA')} · ${answered}/${total} إجابة`
            : `${bank.sections.length} أقسام · ${total} سؤال. الإجابات تُحفَظ في القاعدة لكل عميل.`
        }
      />

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>التقدّم على {company.name}</span>
              <AutosaveChip status={autosaveStatus} />
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">{progressPct}%</div>
        </CardContent>
      </Card>

      {/* 📊 لوحة توازن أنواع التحليل — تكشف الفجوات */}
      {balanceHint && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="flex flex-col gap-2 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚖️</span>
              <div>
                <div className="text-sm font-bold text-amber-900">توازن غير متكافئ في البنك</div>
                <div className="mt-0.5 text-amber-800/80">
                  «{ANALYSIS_TYPE_META[balanceHint.maxType].labelAr}» فيه <b>{balanceHint.max}</b> سؤال بينما
                  «{ANALYSIS_TYPE_META[balanceHint.minType].labelAr}» فيه <b>{balanceHint.min}</b> فقط
                  (فارق {balanceHint.diff}) — أضف أسئلة مخصّصة للنوع الأقلّ.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingForType(balanceHint.minType)}
              className="shrink-0"
            >
              ＋ أضف سؤال لـ «{ANALYSIS_TYPE_META[balanceHint.minType].labelAr}»
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 🎛️ فلاتر أنواع التحليل — التحليل الفني ظاهر الآن كنوع مستقل */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🎛️ فلترة حسب نوع التحليل</CardTitle>
          <CardDescription className="text-xs">
            التحليل العميق في ٣ فئات: 🏛️ إداري · 💰 مالي · 🧪 فنّي — اختر فئة للتركيز عليها، أو اترك «الكلّ».
            <b className="text-foreground"> يمكنك إضافة أسئلة مخصّصة لكل فئة.</b>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          <TypeChip
            active={typeFilter === null}
            onClick={() => setTypeFilter(null)}
            icon="🌐"
            labelAr="الكلّ"
            answered={answered}
            total={total}
            colorCls="border-primary/40 bg-primary/5 text-primary"
          />
          {DEEP_TYPES.map((t) => {
            const stats = typeStats[t]
            if (stats.total === 0) return null
            const meta = ANALYSIS_TYPE_META[t]
            return (
              <TypeChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                icon={meta.icon}
                labelAr={meta.labelAr}
                answered={stats.answered}
                total={stats.total}
                colorCls={meta.color}
              />
            )
          })}
        </CardContent>
        {typeFilter && (
          <CardContent className="pt-0">
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-dashed p-2 text-xs ${ANALYSIS_TYPE_META[typeFilter].color}`}>
              <div>
                <b>{ANALYSIS_TYPE_META[typeFilter].icon} {ANALYSIS_TYPE_META[typeFilter].labelAr}</b>:
                <span className="text-muted-foreground"> {ANALYSIS_TYPE_META[typeFilter].descAr}</span>
              </div>
              <button
                type="button"
                onClick={() => setAddingForType(typeFilter)}
                className="rounded-md border bg-card px-2 py-1 text-[10px] font-medium hover:bg-muted"
              >
                ＋ أضف سؤالاً لهذا النوع
              </button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 📝 نموذج إضافة سؤال مخصّص — يحوي بنك أسئلة جاهزة + كتابة حرّة */}
      {addingForType && (() => {
        const bankQuestions = specialty ? (DEPT_SUPPLEMENTARY_QUESTIONS[specialty]?.[addingForType] ?? []) : []
        const existingLabels = new Set(customQuestions.map((q) => q.label.trim()))
        const availableBank = bankQuestions.filter((q) => !existingLabels.has(q.trim()))
        return (
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              ＋ أضف سؤال في «{ANALYSIS_TYPE_META[addingForType].icon} {ANALYSIS_TYPE_META[addingForType].labelAr}»
              {specialty && <span className="text-muted-foreground"> — لإدارة {DEPT_LABEL[specialty]}</span>}
            </CardTitle>
            <CardDescription className="text-xs">
              اختر من الأسئلة الجاهزة أدناه لتخصّصك، أو اكتب سؤالاً حرّاً.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* بنك الأسئلة الجاهزة لهذا التخصّص × النوع */}
            {availableBank.length > 0 ? (
              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-card p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                  <span>💡</span>
                  <span>أسئلة جاهزة لتخصّصك — نقرة تُضيف</span>
                  <span className="rounded-full border bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{availableBank.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {availableBank.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => addCustomQuestion(addingForType, q)}
                      className="group flex items-start gap-2 rounded-md border bg-card p-2 text-right text-xs transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
                    >
                      <span className="mt-0.5 text-primary opacity-50 group-hover:opacity-100">＋</span>
                      <span className="flex-1 leading-relaxed">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : bankQuestions.length > 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-2 text-center text-[10px] text-muted-foreground">
                ✓ كلّ أسئلة البنك لهذا النوع مضافة سلفاً — استعمل الكتابة الحرّة أدناه.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-2 text-center text-[10px] text-muted-foreground">
                لا يوجد بنك جاهز لهذا النوع في تخصّصك — اكتب سؤالك بحريّة أدناه.
              </div>
            )}

            {/* الكتابة الحرّة */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">أو اكتب سؤالاً خاصّاً بك:</div>
              <Textarea
                rows={2}
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="مثال: كم نسبة العمليّات المؤتمَتة في إدارتك؟"
              />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setAddingForType(null); setNewQuestionText('') }}>
                  إغلاق
                </Button>
                <Button size="sm" onClick={() => addCustomQuestion(addingForType, newQuestionText)} disabled={!newQuestionText.trim()}>
                  إضافة السؤال الحرّ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )
      })()}

      {loading && <LoadingSpinner label="جاري تحميل إجاباتك…" />}

      {visibleGrouped.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا توجد أسئلة من فئة «{ANALYSIS_TYPE_META[typeFilter!]?.labelAr}» في بنك تخصّصك — امسح الفلترة لعرض الكلّ.
          </CardContent>
        </Card>
      )}

      {visibleGrouped.map(({ type, questions }) => {
        const typeMeta = ANALYSIS_TYPE_META[type]
        const answeredInType = questions.filter((q) => answers[q.id] != null).length
        return (
        <Card key={type} className={`overflow-hidden border-2 ${typeMeta.color.split(' ')[0]}`}>
          <div className={`h-1 ${typeMeta.color.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-primary'}`} />
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span aria-hidden>{typeMeta.icon}</span>
              <span>التحليل ال{typeMeta.labelAr}</span>
              <span className="rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {answeredInType}/{questions.length}
              </span>
            </CardTitle>
            <CardDescription>{typeMeta.descAr}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {questions.map((q) => (
              <QuestionField
                key={q.id}
                q={q}
                value={answers[q.id] ?? null}
                onRadio={(v) => setRadio(q.id, v)}
                onCheckbox={(v) => toggleCheckbox(q.id, v)}
                onText={(v) => setText(q.id, v)}
              />
            ))}
          </CardContent>
        </Card>
        )
      })}

      {/* 🎯 الأسئلة المخصّصة (لو المدير أضاف أي منها) — مجموعة بالنوع */}
      {customQuestions.length > 0 && (!typeFilter || customQuestions.some((q) => q.type === typeFilter)) && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">🎯 أسئلتك المخصّصة</CardTitle>
            <CardDescription className="text-xs">
              أسئلة أضفتها لتعميق التحليل — الإجابات تُحفَظ آليّاً مع باقي البنك.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(typeFilter ? customQuestions.filter((q) => q.type === typeFilter) : customQuestions).map((cq) => {
              const tMeta = ANALYSIS_TYPE_META[cq.type]
              return (
                <div key={cq.id} className={`rounded-lg border-2 p-3 ${tMeta.color}`}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="inline-flex items-center gap-1 rounded-full border bg-card px-1.5 py-0.5 text-[10px] font-medium">
                        <span>{tMeta.icon}</span>
                        <span>{tMeta.labelAr}</span>
                      </span>
                      <Label className="mt-1 block text-sm font-medium leading-relaxed">
                        {cq.label}
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustom(cq.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="حذف السؤال"
                    >
                      ×
                    </button>
                  </div>
                  <Textarea
                    rows={2}
                    value={cq.answer}
                    onChange={(e) => updateCustomAnswer(cq.id, e.target.value)}
                    placeholder="اكتب إجابتك…"
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl bg-background/70 p-2 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          الحفظ آلي — يمكنك المغادرة والعودة لاحقاً.
        </span>
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : `حفظ الآن (${answered} إجابة${customQuestions.length > 0 ? ` + ${customQuestions.length} مخصّص` : ''})`}
        </Button>
      </div>

      {/* بطاقة «① التحليل — عدسات اختياريّة». تُخفى عند التضمين في DeptDeepPage. */}
      {!embedded && <NextStepCard clientQuery={clientQuery} companyId={company.id} />}
    </div>
  )
}

// ─── رقيقة فلترة نوع التحليل ───────────────────────────────────
function TypeChip({
  active, onClick, icon, labelAr, answered, total, colorCls,
}: {
  active: boolean
  onClick: () => void
  icon: string
  labelAr: string
  answered: number
  total: number
  colorCls: string
}) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-medium transition ${
        active ? `${colorCls} ring-2 ring-primary shadow-sm` : `${colorCls} hover:shadow`
      }`}
    >
      <span>{icon}</span>
      <span>{labelAr}</span>
      <span className="rounded-full bg-card/70 px-1.5 text-[10px] font-bold tabular-nums">
        {answered}/{total}
      </span>
      {pct > 0 && (
        <span className="text-[9px] opacity-70 tabular-nums">({pct}٪)</span>
      )}
    </button>
  )
}

// ─── R6-fix — مؤشر بصري لحالة الحفظ الآلي ─────────────────────────
function AutosaveChip({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  const meta = {
    saving: { text: '💾 جاري الحفظ…', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
    saved:  { text: '✓ محفوظ',       cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    error:  { text: '⚠️ فشل — سنُعيد المحاولة', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  }[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${meta.cls}`}>
      {meta.text}
    </span>
  )
}

// ─── حقل السؤال — يفرّع حسب النوع (radio/checkbox/textarea) ────────────

function QuestionField({
  q, value, onRadio, onCheckbox, onText,
}: {
  q: QuestionEntry
  value: QAValue | null
  onRadio: (v: string) => void
  onCheckbox: (v: string) => void
  onText: (v: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm leading-relaxed">{q.label}</Label>
      {q.type === 'radio' && <RadioField q={q} value={typeof value === 'string' ? value : null} onSelect={onRadio} />}
      {q.type === 'checkbox' && <CheckboxField q={q} value={Array.isArray(value) ? value : []} onToggle={onCheckbox} />}
      {q.type === 'textarea' && <TextField q={q} value={typeof value === 'string' ? value : ''} onChange={onText} />}
    </div>
  )
}

function RadioField({ q, value, onSelect }: { q: RadioQuestion; value: string | null; onSelect: (v: string) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {q.opts.map((opt) => {
        const checked = value === opt
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition hover:bg-accent ${
              checked ? 'border-primary bg-primary/5' : 'bg-card'
            }`}
          >
            <input
              type="radio"
              name={q.id}
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={checked}
              onChange={() => onSelect(opt)}
            />
            <span className="flex-1 leading-snug">{opt}</span>
          </label>
        )
      })}
    </div>
  )
}

function CheckboxField({ q, value, onToggle }: { q: CheckboxQuestion; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {q.opts.map((opt) => {
        const checked = value.includes(opt)
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition hover:bg-accent ${
              checked ? 'border-primary bg-primary/5' : 'bg-card'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={checked}
              onChange={() => onToggle(opt)}
            />
            <span className="flex-1 leading-snug">{opt}</span>
          </label>
        )
      })}
    </div>
  )
}

function TextField({ q, value, onChange }: { q: TextareaQuestion; value: string; onChange: (v: string) => void }) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder={q.placeholder ?? 'اكتب إجابتك…'}
    />
  )
}

