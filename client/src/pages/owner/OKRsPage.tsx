import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import {
  createOKR, deleteOKR, listKPIs, listObjectives, updateOKR,
  type KPI, type OKR, type Objective,
} from '@/lib/strategicApi'

// ─── OKRs — Objectives & Key Results ────────────────────────────────
// كل هدف (Objective) يحتاج ٣-٥ نتائج رئيسيّة (Key Results) قابلة للقياس رقمياً.
// النتيجة الرئيسيّة ≠ مهمّة (task) ≠ نشاط. هي *النتيجة* التي إن تحقّقت رقميّاً
// دلّت على تقدّم الهدف. المؤشّرات (KPIs) تُقاس بالبيانات الفعليّة لكل KR.

function pct(k: OKR): number {
  if (!k.targetValue) return 0
  return Math.min(100, Math.round((k.currentValue / k.targetValue) * 100))
}

function tint(p: number): string {
  if (p >= 80) return 'border-emerald-300 bg-emerald-50/60'
  if (p >= 50) return 'border-sky-300 bg-sky-50/60'
  if (p >= 25) return 'border-amber-300 bg-amber-50/60'
  return 'border-rose-300 bg-rose-50/60'
}

// ─── بنك قوالب النتائج الرئيسيّة (KR templates) بحسب نوع الهدف ────
// كل قالب: عبارة KR بصياغة قابلة للقياس + وحدة افتراضيّة + هدف رقمي مقترح.
// المستخدم يعدّل النصّ والأرقام قبل الحفظ.
// keywords: كلمات مفتاحيّة في عنوان الهدف تُرجّح ظهور هذا القالب.
interface KRTemplate {
  keyResult: string
  unit: string
  target: number
  reason: string
  keywords?: string[]  // كلمات في عنوان الهدف ترفع أولويّة القالب
  subType?: string     // تصنيف فرعي داخل النوع (مثل: نموّ/تكلفة/سيولة)
}

const KR_TEMPLATES: Record<string, KRTemplate[]> = {
  financial: [
    // نموّ الإيرادات
    { keyResult: 'زيادة الإيرادات السنويّة بنسبة X٪',            unit: '٪',    target: 30,     reason: 'نموّ يعكس النجاح المالي المباشر', keywords: ['إيراد', 'مبيعات', 'نموّ', 'زيادة'], subType: 'نموّ' },
    { keyResult: 'زيادة الإيراد الشهري إلى X ريال',              unit: 'SAR',  target: 500000, reason: 'قياس دوري لسرعة النموّ', keywords: ['إيراد', 'شهر', 'MRR'], subType: 'نموّ' },
    { keyResult: 'رفع متوسّط قيمة الطلب (AOV) إلى X ريال',       unit: 'SAR',  target: 500,    reason: 'رفع القيمة لكل عميل', keywords: ['طلب', 'AOV', 'متوسّط'], subType: 'نموّ' },
    // كفاءة التكلفة
    { keyResult: 'خفض التكاليف التشغيليّة إلى X ريال',          unit: 'SAR',  target: 500000, reason: 'كفاءة تُغذّي الربحيّة', keywords: ['تكلفة', 'خفض', 'توفير'], subType: 'كفاءة' },
    { keyResult: 'خفض نسبة CAC (تكلفة اكتساب العميل) إلى X ريال', unit: 'SAR', target: 200,    reason: 'كفاءة التسويق والمبيعات', keywords: ['CAC', 'اكتساب', 'تكلفة'], subType: 'كفاءة' },
    // ربحيّة
    { keyResult: 'رفع هامش الربح الإجمالي إلى X٪',              unit: '٪',    target: 40,     reason: 'مقياس صحّة المدى القصير', keywords: ['هامش', 'ربح', 'ربحيّة'], subType: 'ربحيّة' },
    { keyResult: 'تحقيق EBITDA إيجابي بمقدار X ريال',            unit: 'SAR',  target: 200000, reason: 'الربح قبل الفوائد والضرائب — مقياس المستثمرين', keywords: ['EBITDA', 'ربح', 'أرباح'], subType: 'ربحيّة' },
    // سيولة
    { keyResult: 'تحقيق تدفّق نقدي تشغيلي X ريال شهرياً',      unit: 'SAR',  target: 100000, reason: 'سيولة تُبقيك حيّاً', keywords: ['نقدي', 'سيولة', 'تدفّق'], subType: 'سيولة' },
    { keyResult: 'رفع نسبة التداول إلى X',                       unit: 'نسبة', target: 1.5,   reason: 'قدرة على تغطية الالتزامات قصيرة الأجل', keywords: ['تداول', 'التزام', 'سيولة'], subType: 'سيولة' },
  ],
  customer: [
    // ولاء
    { keyResult: 'رفع Net Promoter Score إلى X',                  unit: 'NPS',  target: 50,   reason: 'قياس معياري لولاء العميل', keywords: ['NPS', 'ولاء', 'ترويج'], subType: 'ولاء' },
    { keyResult: 'رفع رضا العملاء (CSAT) إلى X٪',                unit: '٪',    target: 85,   reason: 'خبرة إجماليّة قابلة للقياس', keywords: ['رضا', 'CSAT', 'خدمة'], subType: 'رضا' },
    { keyResult: 'رفع Customer Effort Score (CES) إلى X',         unit: 'CES',  target: 8,    reason: 'سهولة التعامل من منظور العميل', keywords: ['CES', 'سهولة', 'جهد'], subType: 'رضا' },
    // احتفاظ
    { keyResult: 'خفض معدّل الترك (Churn) إلى أقلّ من X٪',       unit: '٪',    target: 5,    reason: 'الاحتفاظ أرخص من الاستقطاب', keywords: ['ترك', 'churn', 'احتفاظ', 'انسحاب'], subType: 'احتفاظ' },
    { keyResult: 'رفع Customer Lifetime Value (CLV) إلى X ريال', unit: 'SAR', target: 5000,  reason: 'قيمة العميل عبر رحلته الكاملة', keywords: ['CLV', 'LTV', 'قيمة'], subType: 'احتفاظ' },
    { keyResult: 'رفع معدّل تكرار الشراء إلى X شهرياً',          unit: 'مرّة', target: 3,    reason: 'التكرار مؤشّر ولاء عملي', keywords: ['تكرار', 'شراء', 'عودة'], subType: 'احتفاظ' },
    // نموّ القاعدة
    { keyResult: 'زيادة عدد العملاء النشطين إلى X',              unit: 'عميل', target: 1000, reason: 'نموّ قاعدة قابل للقياس', keywords: ['عدد', 'نشط', 'قاعدة'], subType: 'نموّ' },
    { keyResult: 'زيادة العملاء الجدد شهرياً إلى X',             unit: 'عميل/شهر', target: 100, reason: 'وتيرة الاستقطاب', keywords: ['جديد', 'استقطاب', 'دخول'], subType: 'نموّ' },
  ],
  operations: [
    // سرعة
    { keyResult: 'خفض وقت الاستجابة إلى X ساعة',                 unit: 'ساعة', target: 4,    reason: 'كفاءة تشغيليّة مباشرة', keywords: ['استجابة', 'سرعة', 'زمن'], subType: 'سرعة' },
    { keyResult: 'خفض وقت دورة الطلب (Cycle Time) إلى X يوم',   unit: 'يوم',  target: 3,    reason: 'سرعة التسليم للعميل', keywords: ['دورة', 'تسليم', 'cycle'], subType: 'سرعة' },
    // إنتاجيّة
    { keyResult: 'رفع الإنتاجيّة إلى X وحدة/يوم',                 unit: 'وحدة/يوم', target: 100, reason: 'مقياس ناتج التشغيل', keywords: ['إنتاج', 'وحدة', 'ناتج'], subType: 'إنتاجيّة' },
    { keyResult: 'رفع الطاقة الاستيعابيّة إلى X٪',                unit: '٪',    target: 80,   reason: 'الاستفادة من الموارد المتاحة', keywords: ['طاقة', 'استيعاب', 'utilization'], subType: 'إنتاجيّة' },
    // جودة
    { keyResult: 'خفض نسبة الأخطاء إلى أقلّ من X٪',              unit: '٪',    target: 2,    reason: 'جودة عمليّة', keywords: ['خطأ', 'defect', 'جودة'], subType: 'جودة' },
    { keyResult: 'رفع First Time Right إلى X٪',                   unit: '٪',    target: 95,   reason: 'إتقان من أوّل محاولة', keywords: ['أوّل', 'FTR', 'صحيح'], subType: 'جودة' },
    // كفاءة الأصول
    { keyResult: 'رفع OEE (كفاءة المعدّات) إلى X٪',              unit: '٪',    target: 85,   reason: 'الاستفادة من الأصول', keywords: ['OEE', 'معدّات', 'أصول'], subType: 'أصول' },
    { keyResult: 'خفض التوقّف غير المخطّط إلى أقلّ من X ساعة/شهر', unit: 'ساعة', target: 10, reason: 'موثوقيّة التشغيل', keywords: ['توقّف', 'تعطّل', 'downtime'], subType: 'أصول' },
  ],
  people: [
    // رضا وارتباط
    { keyResult: 'رفع رضا الموظّفين (eNPS) إلى X',                unit: 'eNPS', target: 40,   reason: 'صحّة الفريق', keywords: ['رضا', 'eNPS', 'ارتباط'], subType: 'ارتباط' },
    { keyResult: 'رفع نسبة الارتباط الوظيفي إلى X٪',              unit: '٪',    target: 75,   reason: 'الارتباط يسبق الإنتاجيّة', keywords: ['ارتباط', 'engagement'], subType: 'ارتباط' },
    // احتفاظ
    { keyResult: 'خفض معدّل دوران الموظّفين إلى أقلّ من X٪',    unit: '٪',    target: 10,   reason: 'الاحتفاظ بالكفاءات', keywords: ['دوران', 'turnover', 'ترك', 'استقالة'], subType: 'احتفاظ' },
    { keyResult: 'رفع Regretted Attrition Rate إلى أقلّ من X٪',   unit: '٪',    target: 5,    reason: 'الاحتفاظ بأفضل الأداءات تحديداً', keywords: ['أداء', 'كفاءة', 'موهبة'], subType: 'احتفاظ' },
    // تطوير
    { keyResult: 'إتمام X ساعة تدريب لكل موظّف',                  unit: 'ساعة', target: 40,   reason: 'استثمار في القدرات', keywords: ['تدريب', 'تعلّم', 'تطوير'], subType: 'تطوير' },
    { keyResult: 'رفع نسبة التعاقب الوظيفي إلى X٪',              unit: '٪',    target: 80,   reason: 'استمراريّة القيادة', keywords: ['تعاقب', 'قيادة', 'succession'], subType: 'تطوير' },
    { keyResult: 'رفع نسبة الترقيات الداخليّة إلى X٪',            unit: '٪',    target: 60,   reason: 'مسار وظيفي جاذب', keywords: ['ترقية', 'داخلي', 'مسار'], subType: 'تطوير' },
    // إنتاجيّة
    { keyResult: 'رفع Revenue per Employee إلى X ريال',           unit: 'SAR',  target: 500000, reason: 'مقياس فاعليّة الفريق', keywords: ['إنتاجيّة', 'إيراد', 'موظّف'], subType: 'إنتاجيّة' },
  ],
  innovation: [
    // إطلاق
    { keyResult: 'إطلاق X منتج/خدمة جديدة',                       unit: 'منتج', target: 3,    reason: 'ناتج ابتكاري ملموس', keywords: ['إطلاق', 'منتج', 'جديد'], subType: 'إطلاق' },
    { keyResult: 'رفع نسبة الإيراد من المنتجات الجديدة إلى X٪',  unit: '٪',    target: 20,   reason: 'ابتكار مربح', keywords: ['إيراد', 'جديد', 'مربح'], subType: 'إطلاق' },
    // تجربة
    { keyResult: 'تنفيذ X تجربة/POC',                              unit: 'تجربة', target: 5,    reason: 'وتيرة التعلّم', keywords: ['تجربة', 'POC', 'اختبار'], subType: 'تجربة' },
    { keyResult: 'رفع معدّل التحقّق من الفرضيّات إلى X تجربة/ربع', unit: 'تجربة/ربع', target: 3, reason: 'دورة تعلّم سريعة', keywords: ['فرضيّة', 'تحقّق', 'validate'], subType: 'تجربة' },
    // سرعة
    { keyResult: 'خفض دورة تطوير المنتج إلى X أسبوع',            unit: 'أسبوع', target: 6,    reason: 'سرعة التنفيذ', keywords: ['تطوير', 'دورة', 'سرعة'], subType: 'سرعة' },
    { keyResult: 'خفض Time-to-Market إلى X شهر',                  unit: 'شهر',  target: 3,    reason: 'زمن الوصول للسوق', keywords: ['سوق', 'إطلاق', 'time-to-market'], subType: 'سرعة' },
    // اعتماد
    { keyResult: 'رفع Adoption Rate للميزة الجديدة إلى X٪',       unit: '٪',    target: 60,   reason: 'الابتكار المُستَخدَم فعلاً', keywords: ['اعتماد', 'استخدام', 'adoption'], subType: 'اعتماد' },
    { keyResult: 'حصد X براءة اختراع/حقّ نشر جديد',              unit: 'حقّ',  target: 2,    reason: 'حماية الملكيّة الفكريّة', keywords: ['براءة', 'ملكيّة', 'IP'], subType: 'اعتماد' },
  ],
}

// ─── ترجيح القوالب بحسب كلمات عنوان الهدف ────────────────────
// المنطق: كل قالب له keywords؛ إن ظهرت في عنوان الهدف، يُرفع للقمّة.
// النتيجة: هدف «زيادة الإيرادات» يُبرز قوالب النموّ، بينما «خفض التكاليف»
// يُبرز قوالب الكفاءة — كلاهما داخل نوع 'financial'.
function rankTemplatesForObjective(templates: KRTemplate[], objectiveTitle: string): KRTemplate[] {
  const title = objectiveTitle.toLowerCase()
  return [...templates].sort((a, b) => {
    const aScore = (a.keywords ?? []).filter((k) => title.includes(k.toLowerCase())).length
    const bScore = (b.keywords ?? []).filter((k) => title.includes(k.toLowerCase())).length
    return bScore - aScore
  })
}

// ─── الفلسفة المُبسَّطة لكل نوع Objective (للتفسير التربوي) ─────────
const TYPE_META: Record<string, { icon: string; labelAr: string; philosophyAr: string }> = {
  financial:  { icon: '💰', labelAr: 'مالي',        philosophyAr: 'ماذا نبدو للمساهمين؟ الأرقام أعلى ما يُقاس.' },
  customer:   { icon: '👥', labelAr: 'عميل',        philosophyAr: 'كيف يرانا العملاء؟ الولاء والاحتفاظ لا الاستقطاب فقط.' },
  operations: { icon: '⚙️', labelAr: 'تشغيلي',      philosophyAr: 'في ماذا نتفوّق داخلياً؟ الكفاءة والجودة.' },
  people:     { icon: '👤', labelAr: 'موارد بشريّة', philosophyAr: 'كيف نستمرّ في التحسّن؟ الفريق أوّلاً.' },
  innovation: { icon: '💡', labelAr: 'ابتكار',      philosophyAr: 'كيف نُعيد اختراع نفسنا؟ التجربة والتعلّم.' },
}

export function OKRsPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/measure?tab=okrs${q}`} replace />
}

export function OKRsView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

// شريط تنقّل ↔ الأهداف (upstream) + KPIs (downstream) + BSC.
function CrossNavBar({ clientQuery }: { clientQuery: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
      <span className="text-muted-foreground">
        💡 OKRs تُغذّي KPIs — كل نتيجة رئيسيّة يجب أن يقيسها KPI واحد على الأقل.
      </span>
      <div className="flex flex-wrap gap-2">
        <Link to={`/measure?tab=objectives${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          🎯 الأهداف ←
        </Link>
        <Link to={`/measure?tab=kpis${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-primary transition hover:bg-primary hover:text-primary-foreground">
          📊 KPIs ←
        </Link>
        <Link to={`/measure?tab=bsc${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          ⚖️ BSC ←
        </Link>
      </div>
    </div>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [params] = useSearchParams()
  const client = params.get('client')
  const clientQuery = client ? `&client=${client}` : ''

  const [objectives, setObjectives] = useState<Objective[]>([])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // نموذج إضافة inline لكل هدف — بديل prompt() القبيح.
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [form, setForm] = useState({ keyResult: '', target: '', unit: '' })
  const [creating, setCreating] = useState(false)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)

  useEffect(() => {
    setFetchError(null)
    Promise.all([
      listObjectives(companyId).catch((err) => { console.error('[OKRs] listObjectives failed:', err); throw err }),
      listKPIs(companyId).catch(() => []),
    ]).then(([obs, ks]) => {
      setObjectives(obs)
      setKpis(ks)
    }).catch((err) => {
      setFetchError(apiErrorMessage(err, 'تعذّر جلب الأهداف من الخادم'))
    }).finally(() => setLoading(false))
  }, [companyId])

  async function addFromTemplate(objectiveId: string, tpl: KRTemplate) {
    setGeneratingFor(objectiveId)
    try {
      const okr = await createOKR({
        objectiveId,
        keyResult: tpl.keyResult.replace('X', String(tpl.target)),
        targetValue: tpl.target,
        unit: tpl.unit,
      })
      setObjectives((p) => p.map((o) => (o.id === objectiveId ? { ...o, okrs: [...(o.okrs ?? []), okr] } : o)))
      toast.success(`✓ أُضيفت: «${tpl.keyResult.replace('X', String(tpl.target))}»`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإضافة'))
    } finally {
      setGeneratingFor(null)
    }
  }

  async function generateAllFor(objective: Objective) {
    const rawTemplates = KR_TEMPLATES[objective.type] ?? KR_TEMPLATES.operations
    // نستخدم الترتيب الذكي: القوالب المطابقة لكلمات العنوان أوّلاً.
    const templates = rankTemplatesForObjective(rawTemplates, objective.title)
    setGeneratingFor(objective.id)
    try {
      const existing = new Set((objective.okrs ?? []).map((k) => k.keyResult))
      const created: OKR[] = []
      for (const tpl of templates.slice(0, 3)) {
        const kr = tpl.keyResult.replace('X', String(tpl.target))
        if (existing.has(kr)) continue
        try {
          const okr = await createOKR({
            objectiveId: objective.id,
            keyResult: kr,
            targetValue: tpl.target,
            unit: tpl.unit,
          })
          created.push(okr)
        } catch { /* skip individual failures */ }
      }
      if (created.length === 0) {
        toast.error('كل القوالب المقترحة مُضافة سابقاً.')
        return
      }
      setObjectives((p) => p.map((o) => (o.id === objective.id ? { ...o, okrs: [...(o.okrs ?? []), ...created] } : o)))
      toast.success(`✨ أُضيفت ${created.length} نتائج مطابقة لعنوان «${objective.title.slice(0, 40)}»`)
    } finally {
      setGeneratingFor(null)
    }
  }

  async function submitManualForm(objectiveId: string) {
    const kr = form.keyResult.trim()
    const target = Number(form.target)
    if (!kr) { toast.error('اكتب نصّ النتيجة'); return }
    if (!Number.isFinite(target) || target <= 0) { toast.error('قيمة مستهدفة غير صالحة'); return }
    setCreating(true)
    try {
      const okr = await createOKR({
        objectiveId,
        keyResult: kr,
        targetValue: target,
        unit: form.unit.trim() || undefined,
      })
      setObjectives((p) => p.map((o) => (o.id === objectiveId ? { ...o, okrs: [...(o.okrs ?? []), okr] } : o)))
      setForm({ keyResult: '', target: '', unit: '' })
      setAddingFor(null)
      toast.success('تمت إضافة النتيجة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإضافة'))
    } finally {
      setCreating(false)
    }
  }

  async function updateCurrent(objectiveId: string, okrId: string, currentValue: number) {
    try {
      const updated = await updateOKR(okrId, { currentValue })
      setObjectives((p) => p.map((o) => (o.id === objectiveId
        ? { ...o, okrs: (o.okrs ?? []).map((k) => (k.id === okrId ? { ...k, ...updated } : k)) }
        : o)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(objectiveId: string, okrId: string) {
    if (!confirm('حذف هذه النتيجة الرئيسيّة؟')) return
    try {
      await deleteOKR(okrId)
      setObjectives((p) => p.map((o) => (o.id === objectiveId
        ? { ...o, okrs: (o.okrs ?? []).filter((k) => k.id !== okrId) }
        : o)))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  const allOKRs = useMemo(() => objectives.flatMap((o) => o.okrs ?? []), [objectives])
  const avgProgress = allOKRs.length === 0
    ? 0
    : Math.round(allOKRs.reduce((s, k) => s + pct(k), 0) / allOKRs.length)

  // KPI-to-OKR mapping — يربط كل KPI بالـobjective الذي يقيسه.
  const kpisPerObjective = useMemo(() => {
    const map = new Map<string, KPI[]>()
    for (const k of kpis) {
      if (k.objectiveId) {
        const arr = map.get(k.objectiveId) ?? []
        arr.push(k)
        map.set(k.objectiveId, arr)
      }
    }
    return map
  }, [kpis])

  const objectivesWithoutOkrs = objectives.filter((o) => (o.okrs ?? []).length === 0).length

  if (loading) {
    return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
  }

  return (
    <>
      {fetchError && (
        <Card className="border-rose-300 bg-rose-50/60">
          <CardHeader>
            <CardTitle className="text-rose-900">⚠️ تعذّر جلب OKRs</CardTitle>
            <CardDescription className="text-rose-800">
              {fetchError} — companyId: <code className="rounded bg-white/70 px-1.5 py-0.5 text-[11px]">{companyId}</code>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <CrossNavBar clientQuery={clientQuery} />

      {/* شرح تعليمي — ما هي OKRs وكيف تعمل */}
      <IntroCard />

      {/* بطاقة الملخّص */}
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-amber-500 to-emerald-500" />
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>📊</span>
                <span>متوسّط التقدّم عبر جميع النتائج الرئيسيّة</span>
                <span className="rounded-full border bg-white px-2 py-0.5 text-xs font-medium tabular-nums">
                  {allOKRs.length} KR
                </span>
              </CardTitle>
              <CardDescription>
                {objectives.length} هدف · {allOKRs.length} نتيجة رئيسيّة
                {objectivesWithoutOkrs > 0 && (
                  <span className="mr-2 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                    ⚠️ {objectivesWithoutOkrs} هدف بلا نتائج
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="text-4xl font-bold tabular-nums text-emerald-700">{avgProgress}%</div>
          </div>
          <Progress value={avgProgress} className="mt-3 h-2" />
        </CardHeader>
      </Card>

      {objectives.length === 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50/40">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-amber-900">⚠️ لا توجد أهداف — لا يمكن إضافة نتائج رئيسيّة</CardTitle>
              <CardDescription>
                OKRs تعتمد على الأهداف. أنشئ هدفاً واحداً على الأقلّ في تبويب «الأهداف الاستراتيجيّة»،
                ثم عد لإضافة ٣-٥ نتائج رئيسيّة لكل هدف.
              </CardDescription>
            </div>
            <Link
              to={`/measure?tab=objectives${clientQuery}`}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700"
            >
              🎯 افتح الأهداف ←
            </Link>
          </CardHeader>
        </Card>
      )}

      {/* بطاقة كل هدف مع نتائجه الرئيسيّة + قوالب + KPIs مرتبطة */}
      <div className="grid gap-4">
        {objectives.map((o) => {
          const typeMeta = TYPE_META[o.type] ?? { icon: '📌', labelAr: o.type, philosophyAr: '' }
          const linkedKpis = kpisPerObjective.get(o.id) ?? []
          const templates = KR_TEMPLATES[o.type] ?? KR_TEMPLATES.operations
          const okrs = o.okrs ?? []
          return (
            <Card key={o.id} className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeBg(o.type)}`}>
                        {typeMeta.icon} {typeMeta.labelAr}
                      </span>
                      {okrs.length === 0 && (
                        <span className="rounded-full border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                          ⚠️ بلا نتائج
                        </span>
                      )}
                      {okrs.length >= 3 && okrs.length <= 5 && (
                        <span className="rounded-full border border-emerald-400 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                          ✓ {okrs.length} KR
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-1 text-base leading-tight">🎯 {o.title}</CardTitle>
                    {typeMeta.philosophyAr && (
                      <CardDescription className="text-xs italic text-muted-foreground">
                        {typeMeta.philosophyAr}
                      </CardDescription>
                    )}
                  </div>
                </div>

                {/* أعلى الهدف: مصادر (Objective ← ) ومسارات (→ KPIs) */}
                <div className="mt-2 grid gap-1 text-[10px] sm:grid-cols-2">
                  <div className="rounded-md border border-dashed bg-muted/30 px-2 py-1">
                    <b className="text-foreground">← يأتي من:</b>{' '}
                    الأهداف الاستراتيجيّة (تبويب «الأهداف»)
                  </div>
                  <div className="rounded-md border border-dashed bg-muted/30 px-2 py-1">
                    <b className="text-foreground">→ يذهب إلى:</b>{' '}
                    {linkedKpis.length > 0
                      ? `${linkedKpis.length} KPI مرتبط · ${linkedKpis.slice(0, 2).map((k) => k.name).join(' · ')}${linkedKpis.length > 2 ? '...' : ''}`
                      : 'لا KPI مرتبط بعد — أنشئ KPI في تبويب KPIs واربطه'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* قوالب النتائج الرئيسيّة — الأزرار الذكيّة، مرتّبة بذكاء الكلمات المفتاحيّة */}
                {okrs.length < 5 && (() => {
                  const rankedTemplates = rankTemplatesForObjective(templates, o.title)
                  // تجميع القوالب حسب subType للعرض المنظّم
                  const bySubType = rankedTemplates.reduce<Record<string, KRTemplate[]>>((acc, tpl) => {
                    const key = tpl.subType ?? 'عام'
                    acc[key] = acc[key] ?? []
                    acc[key].push(tpl)
                    return acc
                  }, {})
                  const subTypes = Object.keys(bySubType)
                  const anyMatched = rankedTemplates.some((tpl) =>
                    (tpl.keywords ?? []).some((k) => o.title.toLowerCase().includes(k.toLowerCase()))
                  )
                  return (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold text-primary">
                            ✨ قوالب {typeMeta.icon} {typeMeta.labelAr} — {rankedTemplates.length} خيار
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {anyMatched
                              ? 'مرتّبة بذكاء بحسب كلمات عنوان هذا الهدف تحديداً'
                              : `كل القوالب المتاحة لنوع «${typeMeta.labelAr}» — اختر ما يناسب`}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateAllFor(o)}
                          disabled={generatingFor === o.id}
                          className="h-7 text-[10px]"
                        >
                          {generatingFor === o.id ? 'جاري…' : '＋ ولّد أفضل ٣'}
                        </Button>
                      </div>
                      {subTypes.map((sub) => (
                        <div key={sub} className="mb-2">
                          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {sub}
                          </div>
                          <div className="grid gap-1">
                            {bySubType[sub].map((tpl, i) => {
                              const finalKR = tpl.keyResult.replace('X', String(tpl.target))
                              const already = okrs.some((k) => k.keyResult === finalKR)
                              const matchedKeywords = (tpl.keywords ?? []).filter((k) => o.title.toLowerCase().includes(k.toLowerCase()))
                              return (
                                <button
                                  key={`${sub}-${i}`}
                                  type="button"
                                  disabled={already || generatingFor === o.id}
                                  onClick={() => addFromTemplate(o.id, tpl)}
                                  className={`flex items-start gap-2 rounded-md border p-1.5 text-right text-[11px] transition ${
                                    already
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 opacity-70'
                                      : matchedKeywords.length > 0
                                        ? 'border-primary/50 bg-primary/10 hover:bg-primary/20'
                                        : 'border-transparent bg-card hover:border-primary/30 hover:bg-muted'
                                  }`}
                                  title={tpl.reason}
                                >
                                  <span className="text-xs">{already ? '✓' : '＋'}</span>
                                  <span className="flex-1">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="font-medium">{finalKR}</span>
                                      {matchedKeywords.length > 0 && !already && (
                                        <span className="rounded-full border border-primary/40 bg-primary/15 px-1.5 py-0 text-[8px] text-primary" title={`مطابق لعنوان الهدف: ${matchedKeywords.join('، ')}`}>
                                          ⭐ مطابق
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{tpl.reason}</span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* النتائج الحاليّة */}
                {okrs.length > 0 && (
                  <ul className="space-y-2">
                    {okrs.map((k) => {
                      const p = pct(k)
                      return (
                        <li key={k.id} className={`rounded-xl border-2 p-3 ${tint(p)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-sm font-medium">🔑 {k.keyResult}</div>
                              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                                الهدف: <b className="text-foreground">{k.targetValue.toLocaleString('ar-SA')}{k.unit ? ` ${k.unit}` : ''}</b>
                              </div>
                            </div>
                            <span className="rounded-md border bg-card px-2 py-1 text-xs font-bold tabular-nums">{p}%</span>
                            <button onClick={() => remove(o.id, k.id)} className="text-xs text-muted-foreground hover:text-destructive" title="حذف">🗑️</button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              className="h-8 w-32 bg-background tabular-nums"
                              type="number"
                              value={k.currentValue}
                              onChange={(e) => updateCurrent(o.id, k.id, Number(e.target.value) || 0)}
                              title="القيمة الحاليّة المسجّلة"
                            />
                            <span className="text-xs text-muted-foreground">القيمة الحاليّة</span>
                            <Progress value={p} className="ml-3 h-1.5 flex-1" />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* إضافة يدويّة — inline (لا prompt) */}
                {addingFor === o.id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); submitManualForm(o.id) }}
                    className="grid gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3"
                  >
                    <div className="text-[11px] font-bold text-primary">✍️ نتيجة رئيسيّة مخصّصة</div>
                    <div className="space-y-1">
                      <Label htmlFor={`kr-${o.id}`} className="text-xs">نصّ النتيجة (KR)</Label>
                      <Input
                        id={`kr-${o.id}`}
                        value={form.keyResult}
                        onChange={(e) => setForm((f) => ({ ...f, keyResult: e.target.value }))}
                        placeholder="مثال: زيادة الاحتفاظ بالعميل إلى ٩٠٪"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`target-${o.id}`} className="text-xs">القيمة المستهدفة</Label>
                        <Input
                          id={`target-${o.id}`}
                          type="number"
                          value={form.target}
                          onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                          placeholder="90"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`unit-${o.id}`} className="text-xs">الوحدة</Label>
                        <Input
                          id={`unit-${o.id}`}
                          value={form.unit}
                          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                          placeholder="٪ · SAR · عميل · ساعة"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" type="button" onClick={() => { setAddingFor(null); setForm({ keyResult: '', target: '', unit: '' }) }}>إلغاء</Button>
                      <Button size="sm" type="submit" disabled={creating}>{creating ? 'جاري…' : '💾 حفظ'}</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setAddingFor(o.id)}>
                      ✍️ إضافة يدويّة
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* NextStepCTA */}
      {objectives.length > 0 && (
        <NextStepCTA
          objectivesCount={objectives.length}
          okrsCount={allOKRs.length}
          linkedKpisCount={kpis.filter((k) => k.objectiveId).length}
          clientQuery={clientQuery}
        />
      )}
    </>
  )
}

function typeBg(type: string): string {
  const map: Record<string, string> = {
    financial:  'border-emerald-300 bg-emerald-50 text-emerald-800',
    customer:   'border-sky-300 bg-sky-50 text-sky-800',
    operations: 'border-amber-300 bg-amber-50 text-amber-800',
    people:     'border-violet-300 bg-violet-50 text-violet-800',
    innovation: 'border-rose-300 bg-rose-50 text-rose-800',
  }
  return map[type] ?? 'border-slate-300 bg-slate-50 text-slate-800'
}

function IntroCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardContent className="p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="text-3xl leading-none">🎯</div>
          <div className="flex-1 space-y-2">
            <div>
              <div className="text-sm font-bold text-foreground">ما هي OKRs ولماذا هي الأهم؟</div>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">O</b> = Objective (هدف نصيّ طموح: «نصبح رائد السوق»)،{' '}
                <b className="text-foreground">KR</b> = Key Result (نتيجة رقميّة تُثبت التحقّق: «حصّة سوق ٤٠٪»).
                الهدف بلا نتائج مقاسة أمنيةٌ لا خطة. القاعدة الذهبيّة: <b className="text-foreground">٣-٥ نتائج لكل هدف</b> — أقلّ يعني ضعف قياس، أكثر يعني تشتّت.
              </p>
            </div>
            <div className="rounded-md border border-dashed bg-white/70 p-2">
              <b className="text-foreground">📐 صياغة قوّية للـKR:</b>{' '}
              فِعل + مقياس رقمي + عتبة + أفق زمني.{' '}
              <span className="text-muted-foreground">
                مثال ضعيف: «تحسين رضا العميل». مثال قوّي: «رفع CSAT إلى ٨٥٪ خلال Q4».
              </span>
            </div>
            <div className="rounded-md border border-dashed bg-white/70 p-2">
              <b className="text-foreground">🔗 التسلسل الكامل:</b>{' '}
              <span className="text-muted-foreground">
                الأهداف → OKRs → KPIs → إدخالات → الرسم البياني (متوقّع vs واقع). كل حلقة تُغذّي التاليّة.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function NextStepCTA({
  objectivesCount, okrsCount, linkedKpisCount, clientQuery,
}: { objectivesCount: number; okrsCount: number; linkedKpisCount: number; clientQuery: string }) {
  // ٠ OKRs — قفل الانتقال إلى KPIs.
  if (okrsCount === 0) {
    return (
      <Card className="border-2 border-amber-300 bg-amber-50/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-amber-900">⚠️ أضِف نتيجة رئيسيّة واحدة على الأقلّ</CardTitle>
            <CardDescription>
              KPIs تُقاس بنتائج (KRs) — بلا نتائج، لا شيء لتقيسه. استعمل «✨ ولّد ٣ نتائج» على أي هدف أعلاه.
            </CardDescription>
          </div>
          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground opacity-60">
            📊 KPIs 🔒
          </span>
        </CardHeader>
      </Card>
    )
  }
  // KRs موجودة لكن لا KPIs مرتبطة — تحذير + دعوة للربط.
  if (linkedKpisCount === 0) {
    return (
      <Card className="border-2 border-sky-300 bg-sky-50/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-sky-900">
              📊 لديك {okrsCount} نتيجة رئيسيّة — الآن اربطها بمؤشّرات
            </CardTitle>
            <CardDescription>
              كل KR يحتاج KPI يقيسه بالبيانات الفعليّة. في تبويب KPIs، أنشئ مؤشّراً واربطه بالهدف المناسب.
            </CardDescription>
          </div>
          <Link
            to={`/measure?tab=kpis${clientQuery}`}
            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
          >
            📊 اذهب إلى KPIs ←
          </Link>
        </CardHeader>
      </Card>
    )
  }
  // الحالة المثاليّة: أهداف + نتائج + KPIs مرتبطة.
  return (
    <Card className="border-2 border-emerald-300 bg-emerald-50/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base text-emerald-900">
            ✓ التسلسل الكامل مربوط — {objectivesCount} هدف · {okrsCount} KR · {linkedKpisCount} KPI
          </CardTitle>
          <CardDescription>
            الآن سجّل قيم دوريّة للـKPIs لتظهر الاتّجاهات الفعليّة.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/measure?tab=entries${clientQuery}`}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            ✍️ إدخالات KPIs ←
          </Link>
          <Link
            to={`/measure?tab=bsc${clientQuery}`}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            ⚖️ BSC ←
          </Link>
        </div>
      </CardHeader>
    </Card>
  )
}
